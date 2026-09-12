import { IonActionSheet, IonAlert, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonSpinner, IonText, useIonRouter, useIonToast } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { alarm, alarmOutline, arrowForwardCircleOutline, arrowForwardOutline, attachOutline, bookmarkOutline, bookmarkSharp, bookSharp, briefcaseOutline, checkmarkCircleOutline, checkmarkCircleSharp, chevronForwardOutline, closeOutline, ellipsisVertical, pencil, pencilOutline, pencilSharp, shapesOutline, textOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery, useLazyGetNoteByIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';
import { getUser } from '../../utils/authState';
import NotesRepository from '../../databases/datasources/NotesRepository';

interface Props {
    workspaceId?: string;
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
    onRefreshPapers?: (item: NoteTypes) => void;
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

const NoteItem: React.FC<{
    item: NoteTypes,
    isLast: boolean,
    user: { id: string },
    workspaceId?: string,
    onShowOptions?: (item: NoteTypes) => void,
    onRefreshPapers?: (item: NoteTypes) => void
}> = ({
    item,
    isLast,
    user,
    workspaceId,
    onShowOptions,
    onRefreshPapers
}) => {
        const { content_preview } = item;

        let editor: string = 'richtext';

        if (item.content_type == 'canvas') {
            editor = 'canvas';
        } else if (item.content_type == 'file') {
            editor = 'files';
        }

        let linkTo: string = `/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}${item.clustered_date ? `&clusteredDate=${item.clustered_date}` : ''}`;

        // if not the creator, view the note as a normal viewer
        if (item.user.id !== user.id) {
            linkTo = `/dashboard/workspace/note-viewer?workspaceId=${item.workspace_id}&noteId=${item.id}`;
        }

        const optionsHandler = async (item: NoteTypes) => {
            onShowOptions?.(item);
        }

        const refreshPapers = async (item: NoteTypes) => {
            onRefreshPapers?.(item);
        }

        return (
            <IonCard className='rounded-xl'>
                <IonCardContent className='!p-0 h-full'>
                    <div className="w-full h-full flex flex-col">
                        <div className='ion-padding'>
                            {item.clustered_date && (
                                <div className='flex mb-2 gap-2.5'>
                                    <div className='inline-block'>
                                        <div className='flex items-center gap-1.5 bg-yellow-100 px-1 pr-1.5 py-0.5 pl-1.5 rounded-xl shadow'>
                                            <IonIcon icon={bookmarkSharp} color="warning"></IonIcon>
                                            <IonText className='text-xs text-yellow-800'>Materialized</IonText>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className='flex'>
                                <Link to={linkTo} className='block w-full flex-1'>
                                    <div className='flex gap-1 !m-0 items-center !text-sm flex-wrap'>
                                        <div className={`flex items-center gap-1.5`}>
                                            {item.content_type === 'text' && <IonIcon icon={textOutline} className='text-base text-neutral-500' />}
                                            {item.content_type === 'canvas' && <IonIcon icon={shapesOutline} className='text-base text-neutral-500' />}
                                            {item.content_type === 'file' && <IonIcon icon={attachOutline} className='text-base text-neutral-500' />}

                                            <IonText className={`text-sm flex gap-1 ${item.pages_status === 'published' ? 'text-lime-800' : 'text-blue-800'}`}>
                                                <span className='font-semibold'>{item.page_count || 0}</span>
                                                {item.pages_status == 'published' ? 'finished' : 'draft'}
                                            </IonText>
                                        </div>
                                        <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                                        <IonText className='text-sm text-neutral-500'>{format(item.created_at, 'MM/dd/yy')}</IonText>
                                        <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                                        <IonText className='text-sm text-neutral-500'>{format(item.created_at, 'HH:mm')}</IonText>
                                    </div>
                                    <IonText color="dark font-semibold text-sm block mt-1">{item.user.name}</IonText>
                                </Link>

                                <div className='ml-auto'>
                                    <div className='flex gap-2'>
                                        {(user.id === item.user.id && !item.clustered_date) && (
                                            <IonButton shape='round' size='small' color={'light'} disabled={Boolean(item.clustered_date)} onClick={async () => await optionsHandler(item)}>
                                                <IonIcon icon={ellipsisVertical} slot='icon-only' />
                                            </IonButton>
                                        )}

                                        <IonButton shape='round' size='small' color={'light'} routerLink={linkTo} routerDirection='forward'>
                                            <IonIcon icon={chevronForwardOutline} slot='icon-only' />
                                        </IonButton>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {content_preview && (
                            <>
                                <div className='ion-padding-start ion-padding-end'>
                                    {item.workspace && !workspaceId && (
                                        <div className='flex items-center gap-2 text-orange-700 mb-2'>
                                            <IonIcon icon={briefcaseOutline}></IonIcon>
                                            <IonText className='text-xs'>{item.workspace.title}</IonText>
                                        </div>
                                    )}

                                    <Link to={linkTo}>
                                        <div
                                            dangerouslySetInnerHTML={{ __html: content_preview }}
                                            className='text-neutral-800 text-base leading-6 line-clamp-4'
                                        />
                                    </Link>
                                </div>

                                <div className='block mt-auto pt-2.5'>
                                    <div className='py-3'>
                                        <div className='ion-padding-start mb-2'>
                                            <IonText className='!text-neutral-700 underline italic'>Relevant papers:</IonText>
                                        </div>
                                        {item.documents?.length > 0 && (
                                            <div className='flex flex-col gap-2 ion-padding-start ion-padding-end'>
                                                {item.documents.slice(0, 2).map((doc: any, index: number, array: any) => {
                                                    return (
                                                        <Link key={doc.id} to={doc.paper.pdf_url} target="_blank" rel="noopener noreferrer">
                                                            <div className='flex flex-col gap-0.5'>
                                                                <p className='!text-blue-700 mb-0 !text-xs'>{doc.paper.title}</p>
                                                                <p className='line-clamp-2 !overflow-hidden !text-xs text-neutral-600'>{doc.document_content}</p>
                                                            </div>
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {item.documents?.length === 0 && (
                                            <IonItem style={{ '--background': 'none' }} button={true} mode="md" detail={false} lines='none'>
                                                <IonSpinner slot="start" className='w-3 h-3'></IonSpinner>
                                                <IonLabel className='pl-2'>
                                                    <p className='text-neutral-500 !text-xs'>Discovering...</p>
                                                </IonLabel>
                                                <IonButton slot='end' fill='clear' className='text-xs' mode="ios" onClick={async () => await refreshPapers(item)}>
                                                    tap here to refresh
                                                </IonButton>
                                            </IonItem>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </IonCardContent>
            </IonCard>
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

    // RTK Query
    const [getNoteById, { data: noteData, isLoading: gettingNote, isError: gettingNoteError }] = useLazyGetNoteByIdQuery();
    const { data, isLoading, isFetching, isSuccess, isError } = useGetNotesByWorkspaceIdQuery({
        workspace_id: workspaceId,
        page: page,
        pageSize: 20,
    });

    const groupedNotes = useMemo(() => groupNotesByDate(data?.notes ?? []), [data?.notes]);
    const hasMore = (data?.notes.length ?? 0) < (data?.count ?? 0);

    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching && hasMore) {
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

    const refreshPapers = async (item: NoteTypes) => {
        await getNoteById({ id: item.id, workspace_id: workspaceId as string });
    }

    if (isLoading && page === 1) {
        return (
            <div className="ion-padding text-center">
                <IonText className='text-center ion-padding'>Loading...</IonText>
            </div>
        );
    }

    return (
        <>
            <div id="notelist" className='flex flex-col gap-4 notes-list ion-padding'>
                {groupedNotes.map(({ dateKey, notes }) => (
                    <div key={dateKey} className='block flex flex-col w-full gap-4'>
                        <div className='block ion-padding-start -mb-2'>
                            <IonText className='font-semibold text-orange-600'>
                                {formatDateHeader(dateKey)}
                            </IonText>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 xl:gap-5'>
                            {notes.map((item, index, array) => {
                                const isLast = index === array.length - 1;
                                return (
                                    <NoteItem
                                        key={item.id}
                                        item={item}
                                        user={user}
                                        isLast={isLast}
                                        workspaceId={workspaceId}
                                        onShowOptions={optionsHandler}
                                        onRefreshPapers={refreshPapers}
                                    />
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <IonInfiniteScroll
                disabled={isError || !hasMore}
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
                            await presentToast({ message: 'Note deleted successfully', duration: 750, color: 'success' })
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