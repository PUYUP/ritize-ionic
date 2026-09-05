import { IonActionSheet, IonAlert, IonButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonText, useIonRouter, useIonToast } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { attachOutline, bookOutline, closeOutline, documentOutline, ellipsisVertical, pencilOutline, shapesOutline, textOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';
import { getUser } from '../../utils/authState';
import NotesRepository from '../../databases/datasources/NotesRepository';

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
    onShowOptions?: (item: NoteTypes) => void;
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

const NoteItem: React.FC<{ item: NoteTypes, user: { id: string }, onShowOptions?: (item: NoteTypes) => void }> = ({ item, user, onShowOptions }) => {
    const { content_preview } = item;
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

    const optionsHandler = async (item: NoteTypes) => {
        onShowOptions?.(item);
    }

    return (
        <IonItem lines="full" className='note-item'>
            <div className='w-full py-3'>
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
                            <IonButton shape='round' color={'light'} onClick={async () => await optionsHandler(item)}>
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

                {item.papers?.length > 0 && (
                    <div className='block mb-2 py-1 bg-neutral-100 mt-3 rounded-xl'>
                        <IonList lines="none" className='flex flex-col gap-6 !py-0 bg-neutral-100'>
                            <IonItemDivider className='bg-neutral-100 px-3'>
                                <IonLabel className='!text-neutral-700 underline italic'>Referenced Papers:</IonLabel>
                            </IonItemDivider>
                            {item.papers.slice(0, 2).map((paper: any, index: number, array: any) => {
                                const isLast = index === array.length - 1;
                                return (
                                    <IonItem
                                        key={paper.id}
                                        lines={isLast ? 'none' : 'full'}
                                        className='bg-neutral-100'
                                        style={{ '--background': 'none' }}
                                        button={true}
                                        mode="md"
                                        detail={false}
                                        href={paper.paper.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <IonIcon slot='start' icon={bookOutline} className="text-lg mt-1" color="primary" />
                                        <IonLabel className='ion-padding-start py-1'>
                                            <p className='!text-blue-700'>{paper.paper.title}</p>
                                        </IonLabel>
                                    </IonItem>
                                )
                            })}
                        </IonList>
                    </div>
                )}
            </div>
        </IonItem >
    )
}

const NoteList: React.FC<Props> = ({ workspaceId }) => {
    const ionRouter = useIonRouter();
    const [presentToast] = useIonToast();
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [selectedNote, setSelectedNote] = useState<NoteTypes | null>(null);
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

    const optionsHandler = (item: NoteTypes) => {
        setSelectedNote(item);
        setShowOptions(true);
    }

    if (isLoading && page === 1) return <IonText className='text-center ion-padding'>Loading...</IonText>;

    return (
        <>
            <IonList id="notelist" className='flex flex-col gap-6 !pt-0'>
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
                            <NoteItem key={item.id} item={item} user={user} onShowOptions={optionsHandler} />
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

            <IonActionSheet
                isOpen={showOptions}
                onDidDismiss={() => {
                    setShowOptions(false);
                }}
                header="Note Actions"
                buttons={[
                    {
                        text: 'Edit',
                        icon: pencilOutline,
                        data: {
                            action: 'edit',
                        },
                        handler: () => {
                            if (!selectedNote) return;

                            let editor: string = 'richtext';

                            if (selectedNote.content_type == 'canvas') {
                                editor = 'canvas';
                            } else if (selectedNote.content_type == 'file') {
                                editor = 'file';
                            }
                            ionRouter.push(`/dashboard/editor/${editor}?workspaceId=${selectedNote.workspace_id}&noteId=${selectedNote.id}`, "forward");
                        }
                    },
                    {
                        text: 'Delete',
                        icon: trashOutline,
                        role: 'destructive',
                        data: {
                            action: 'delete',
                        },
                        handler: () => {
                            if (!selectedNote) return;
                            setShowDeleteAlert(true);
                        },
                    },
                    {
                        text: 'Cancel',
                        icon: closeOutline,
                        role: 'cancel',
                        data: {
                            action: 'cancel',
                        },
                    },
                ]}
            ></IonActionSheet>

            {/* delete note */}
            <IonAlert
                isOpen={showDeleteAlert}
                onDidDismiss={() => setShowDeleteAlert(false)}
                header='Are you sure to remove this note?'
                message={'All related data on this note will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            if (!selectedNote) return;
                            await NotesRepository.deleteNote(selectedNote.id, selectedNote.workspace_id);
                            await presentToast({ message: 'Note deleted successfully', duration: 2500, color: 'success' })
                            setShowDeleteAlert(false);
                            setSelectedNote(null);
                        },
                    },
                ]}
            ></IonAlert>
        </>
    )
}

export default NoteList;