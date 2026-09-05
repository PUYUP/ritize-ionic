import { IonButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonText } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { attachOutline, documentOutline, ellipsisVertical, shapesOutline, textOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';
import { getUser } from '../../utils/authState';

interface Props {
    workspaceId: string;
}

// --- Grouping helpers (per-day, based on note_datetime) ---

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** Extract the "YYYY-MM-DD" date key from note_datetime, with no timezone conversion. */
const getDateKey = (isoString: string): string => isoString.slice(0, 10);

/** "2026-09-05" -> "September 5, 2026" (safe from timezone shifts when parsing Date). */
const formatDateHeader = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
};

interface NoteGroup {
    dateKey: string;
    notes: NoteTypes[];
}

/**
 * Group notes by note_datetime (per day).
 * The order of dates and notes within each group follows the original API order
 * (not re-sorted), to stay consistent with pagination/infinite scroll.
 */
const groupNotesByDate = (notes: NoteTypes[]): NoteGroup[] => {
    const map = new Map<string, NoteTypes[]>();

    for (const note of notes) {
        const key = getDateKey(note.note_datetime);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(note);
    }

    return [...map.entries()].map(([dateKey, groupNotes]) => ({ dateKey, notes: groupNotes }));
};

const NoteItem: React.FC<{ item: NoteTypes, user: { id: string } }> = ({ item, user }) => {
    const { content_preview, created_at } = item;
    let editor: string = 'richtext';

    if (item.content_type == 'canvas') {
        editor = 'canvas';
    } else if (item.content_type == 'file') {
        editor = 'file';
    }

    let linkTo: string = `/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}`;

    // if not the creator, view the note as a normal viewer
    if (item.user.id !== user.id) {
        linkTo = `/dashboard/workspace/note-viewer?workspaceId=${item.workspace_id}&noteId=${item.id}`;
    }

    return (
        <IonItem lines="none" className='note-item'>
            <IonLabel>
                <div className='flex'>
                    <Link to={linkTo} className='block w-full flex-1'>
                        <p className='flex gap-2 !m-0 items-center'>
                            <IonText className='text-sm text-neutral-500 uppercase'>{format(item.created_at, 'MMM dd, yy')}</IonText>
                            <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                            <IonText className='text-sm text-neutral-500 uppercase'>{format(item.created_at, 'HH:mm')}</IonText>
                            <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                            <span className='flex gap-1 items-center'>
                                {item.content_type === 'text' && <IonIcon icon={textOutline} className='text-sm text-neutral-500' />}
                                {item.content_type === 'canvas' && <IonIcon icon={shapesOutline} className='text-sm text-neutral-500' />}
                                {item.content_type === 'file' && <IonIcon icon={attachOutline} className='text-sm text-neutral-500' />}
                                <IonText className='text-sm text-neutral-500'>{item.page_count?.[0]?.count || 0} page</IonText>
                            </span>
                        </p>
                        <IonText color="dark font-semibold">{item.user.name}</IonText>
                    </Link>

                    {user.id === item.user.id && (
                        <div className='ml-auto'>
                            <IonButton shape='round' color={'medium'} fill='clear'>
                                <IonIcon icon={ellipsisVertical} slot='icon-only' />
                            </IonButton>
                        </div>
                    )}
                </div>

                <Link to={linkTo}>
                    {content_preview && (
                        <div
                            dangerouslySetInnerHTML={{ __html: content_preview }}
                            className='text-neutral-800 text-base leading-6 mt-1 line-clamp-4'
                        />
                    )}
                </Link>
            </IonLabel>
        </IonItem >
    )
}

const NoteList: React.FC<Props> = ({ workspaceId }) => {
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [user, setUser] = useState({ id: '' });
    const [page, setPage] = useState(1);
    const { data, isLoading, isFetching, isSuccess, isError } = useGetNotesByWorkspaceIdQuery({
        workspace_id: workspaceId,
        page: page,
        pageSize: 20,
    });

    const groupedNotes = useMemo(() => groupNotesByDate(data?.notes ?? []), [data?.notes]);

    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching) {
            setPage((p) => p + 1);
            console.log("page: ", page);
        }

        setIonScrollEl(e.target as HTMLIonInfiniteScrollElement);
    };

    useEffect(() => {
        (async () => {
            const u = await getUser();
            setUser(u);
        })()
    }, []);

    useEffect(() => {
        if (isSuccess && !isFetching) {
            ionScrollEl?.complete();
        }
    }, [isSuccess, isFetching]);

    if (isLoading && page === 1) return <IonText className='text-center ion-padding'>Loading...</IonText>;

    return (
        <>
            <IonList id="notelist" className='flex flex-col gap-6'>
                {groupedNotes.map(({ dateKey, notes }) => (
                    <IonItemGroup key={dateKey}>
                        <IonItemDivider sticky color="light">
                            <IonLabel className='ion-padding-start ion-padding-end'>
                                <IonText className='font-semibold text-orange-600 uppercase tracking-wide'>
                                    {formatDateHeader(dateKey)}
                                </IonText>
                            </IonLabel>
                        </IonItemDivider>

                        {notes.map((item) => (
                            <NoteItem key={item.id} item={item} user={user} />
                        ))}
                    </IonItemGroup>
                ))}
            </IonList>

            <IonInfiniteScroll
                disabled={isError}
                onIonInfinite={(event) => {
                    handleIonInfinite(event);
                    setTimeout(() => event.target.complete(), 500);
                }}
            >
                <IonInfiniteScrollContent></IonInfiniteScrollContent>
            </IonInfiniteScroll>
        </>
    )
}

export default NoteList;