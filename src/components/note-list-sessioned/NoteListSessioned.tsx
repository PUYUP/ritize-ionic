import { IonActionSheet, IonAlert, IonButton, IonCard, IonCardContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonSpinner, IonText, useIonRouter, useIonToast } from '@ionic/react';
import { format } from 'date-fns';
import './NoteListSessioned.css';
import { chevronForwardOutline, closeOutline, documentText, ellipsisVertical, imageOutline, pencilOutline, shapesOutline, textOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { NotePageTypes, NoteTypes, useGetNotesByWorkspaceIdQuery, useLazyGetNoteByIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';
import { getUser } from '../../utils/authState';
import NotesRepository from '../../databases/datasources/NotesRepository';

interface Props {
    workspaceId?: string;
    learningSessionId?: string;
}

// --- Grouping helpers (per-day, based on note_datetime) ---

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** Extract the "YYYY-MM-DD" date key from note_datetime, with no timezone conversion. */
const getDateKey = (isoString: string): string => isoString?.slice(0, 10);

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

const NoteItemMinimal: React.FC<{
    item: NoteTypes,
    isLast: boolean,
    user: { id: string },
    workspaceId?: string,
    learningSessionId?: string,
    onShowOptions?: (item: NoteTypes) => void,
    onRefreshPapers?: (item: NoteTypes) => void
}> = ({
    item,
    isLast,
    user,
    workspaceId,
    learningSessionId,
    onShowOptions,
    onRefreshPapers
}) => {
        let editor: string = 'richtext';

        if (item.content_type == 'canvas') {
            editor = 'canvas';
        } else if (item.content_type == 'file') {
            editor = 'files';
        }

        let linkTo: string = `/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}${item.clustered_date ? `&clusteredDate=${item.clustered_date}` : ''}${learningSessionId ? `&sessionId=${learningSessionId}` : ''}`;

        // if not the creator, view the note as a normal viewer
        // if (item?.user?.id !== user.id) {
        //     linkTo = `/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}&clusteredDate=1${learningSessionId ? `&sessionId=${learningSessionId}` : ''}`;
        // }

        const refreshPapers = async (item: NoteTypes) => {
            onRefreshPapers?.(item);
        }

        const optionsHandler = async (item: NoteTypes) => {
            onShowOptions?.(item);
        }

        // build circle color
        let circleBackground = 'bg-neutral-200';
        let circleColor = 'text-neutral-700';
        let borderColor = 'border-neutral-100';

        if (item.content_type === 'text') {
            circleBackground = 'bg-[#E1F2F1]';
            circleColor = 'text-[#008C88]';
            borderColor = 'border-[#008C88]/30';
        } else if (item.content_type === 'canvas') {
            circleBackground = 'bg-[#E9F4E5]';
            circleColor = 'text-[#32A315]';
            borderColor = 'border-[#32A315]/30';
        } else if (item.content_type === 'file') {
            circleBackground = 'bg-[#EEE4FA]';
            circleColor = 'text-[#5B00C9]';
            borderColor = 'border-[#5B00C9]/30';
        }

        if (item.clustered_date) {
            circleBackground = 'bg-red-200';
            circleColor = 'text-red-700';
            borderColor = 'border-red-300';
        }

        let badgeBackground: string = 'bg-neutral-200';
        let badgeColor: string = 'text-neutral-600';

        if (item.pages_status == 'published') {
            badgeBackground = 'bg-green-200';
            badgeColor = 'text-green-800';
        }

        if (item.clustered_date) {
            badgeBackground = 'bg-purple-200';
            badgeColor = 'text-purple-800';
        }

        if (item.page_count <= 0) {
            badgeBackground = 'bg-gray-200';
            badgeColor = 'text-gray-500';
        }

        return (
            <div className='block'>
                <div className='flex mb-1 items-center'>
                    <div className='flex items-center gap-2'>
                        <div className={`w-6 h-6 ${circleBackground} shadow-sm border ${borderColor} rounded-full relative z-10 flex items-center justify-center`}>
                            {item.content_type === 'text' && <IonIcon icon={textOutline} className={`text-sm ${circleColor}`} />}
                            {item.content_type === 'canvas' && <IonIcon icon={shapesOutline} className={`text-sm ${circleColor}`} />}
                            {item.content_type === 'file' && <IonIcon icon={imageOutline} className={`text-sm ${circleColor}`} />}
                        </div>

                        <div className='albert-font flex gap-3 items-center items-center'>
                            <IonText className='font-normal text-neutral-600 text-base oswald-font'>{format(item.created_at, 'HH:mm')}</IonText>
                            <IonText className='text-neutral-500 font-normal text-sm pt-0.5'>{item.pages?.length ?? 0} pages</IonText>
                        </div>
                    </div>

                    <div className='ml-auto'>
                        <div className='flex gap-2'>
                            {!item.clustered_date && (
                                <IonButton shape='round' mode="ios" size='small' color={'light'} disabled={Boolean(item.clustered_date)} onClick={async () => await optionsHandler(item)}>
                                    <IonIcon icon={ellipsisVertical} slot='icon-only' className='text-neutral-500' />
                                </IonButton>
                            )}
                        </div>
                    </div>
                </div>

                <div className='pl-8'>
                    {item.content_type == 'text' && (
                        <div className='flex flex-col gap-3'>
                            {[...(item?.pages ?? [])]?.sort((a, b) => (b.page_num || 0) - (a.page_num || 0)).map(p => {
                                let statusColor = 'text-neutral-500';
                                if (p.status == 'published') {
                                    statusColor = 'text-green-800';
                                }

                                return (
                                    <IonCard key={p.id} className='rounded-xl' routerLink={`${linkTo}&pageId=${p.id}`}>
                                        <IonCardContent>
                                            <div className='flex gap-2'>
                                                <div className='flex-1 min-w-0'>  {/* flex-0 → flex-1, tambah min-w-0 */}
                                                    <div className='flex gap-2 albert-font text-[10px] uppercase items-center'>
                                                        <div className='flex gap-1 items-center'>
                                                            <IonIcon className='text-xs text-neutral-400' icon={documentText} />
                                                            <IonText className='text-xs'>{p.page_num}</IonText>
                                                        </div>

                                                        <IonText className='text-neutral-400'>&bull;</IonText>
                                                        <IonText className={`${statusColor} tracking-wider`}>{p.status == 'published' ? 'saved' : 'draft'}</IonText>
                                                    </div>
                                                    {p.content_text && (
                                                        <div
                                                            dangerouslySetInnerHTML={{ __html: p.content_text }}
                                                            className='text-neutral-700 text-sm leading-5 line-clamp-2 w-full mt-1'
                                                        />
                                                    )}
                                                </div>

                                                <div className='ml-auto flex items-center shrink-0'>  {/* tambah shrink-0 */}
                                                    <IonButton shape='round' size='small' color={'light'} className='min-w-[16px] min-h-[16px]'>
                                                        <IonIcon icon={chevronForwardOutline} className='text-xs' slot='icon-only'></IonIcon>
                                                    </IonButton>
                                                </div>
                                            </div>
                                        </IonCardContent>
                                    </IonCard>
                                )
                            })}
                        </div>
                    )}

                    {item.content_type == 'canvas' && (
                        <div className='block grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-3 gap-3'>
                            {item.pages?.map((p: NotePageTypes) => {
                                const mediaLink = p?.attachments?.[0]?.file?.media_link;

                                return (
                                    <IonCard key={p.id} className='rounded-xl' routerLink={`${linkTo}&pageId=${p.id}`}>
                                        <IonCardContent className='relative'>
                                            <div className="relative aspect-square overflow-hidden">
                                                <div className='absolute left-0 right-0 bottom-0 top-0 rounded-xl flex items-center justify-center'>
                                                    {mediaLink && <img src={mediaLink} className='w-full h-full object-cover' />}
                                                    {!mediaLink && (
                                                        <IonText className='text-xs text-center' color="medium">Currently is draft</IonText>
                                                    )}
                                                </div>
                                            </div>

                                            <div className='absolute flex justify-between bottom-2 left-2 right-2'>
                                                <div className='flex items-center gap-1'>
                                                    <IonIcon className='text-xs text-neutral-400' icon={documentText} />
                                                    <IonText className='text-xs'>{p.page_num}</IonText>
                                                </div>

                                                <IonButton shape='round' size='small' color={'light'} className='min-w-[16px] min-h-[16px]'>
                                                    <IonIcon icon={chevronForwardOutline} className='text-xs' slot='icon-only'></IonIcon>
                                                </IonButton>
                                            </div>
                                        </IonCardContent>
                                    </IonCard>
                                )
                            })}
                        </div>
                    )}

                    {(item.content_type == 'file' && item.page_count > 0) && (
                        <Link to={linkTo}>
                            <div className='ion-padding-start ion-padding-bottom ion-padding-end'>
                                <div className='block grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-3 gap-3'>
                                    {item.pages?.slice(0, 5)?.map((p: any) => {
                                        const mediaLink = p?.attachments?.[0]?.file?.media_link;

                                        return (
                                            <div key={p.id} className="relative aspect-square overflow-hidden">
                                                <div className='absolute left-0 right-0 bottom-0 top-0 border border-neutral-200 p-2 rounded-xl shadow flex items-center justify-center'>
                                                    {mediaLink && <img src={mediaLink} className='w-full h-full object-cover' />}
                                                    {!mediaLink && (
                                                        <IonText className='text-xs text-center' color="medium">Currently is drafted</IonText>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {item?.pages && item?.pages?.length >= 5 && (
                                        <div key={8818484} className="relative aspect-square overflow-hidden">
                                            <div className='absolute left-0 right-0 bottom-0 top-0 border border-neutral-200 p-2 rounded-xl shadow flex items-center justify-center bg-neutral-100'>
                                                <IonText className='text-xs text-center' color="medium">View more...</IonText>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    )}

                    {(item.status === 'published' && item.pages_status == 'published') && (
                        <div className='block mt-auto border-t border-neutral-200'>
                            <div className='py-3'>
                                <div className='ion-padding-start mb-2'>
                                    <IonText className='!text-neutral-800 tracking-widest uppercase !text-xs'>Relevant papers:</IonText>
                                </div>
                                {item.documents?.length > 0 && (
                                    <div className='flex flex-col gap-2 ion-padding-start ion-padding-end'>
                                        {item?.documents?.slice(0, 2).map((doc: any, index: number, array: any) => {
                                            return (
                                                <Link key={doc.id} to={doc.paper.pdf_url} target="_blank" rel="noopener noreferrer">
                                                    <div className='flex flex-col gap-0.5'>
                                                        <p className='!text-blue-700 mb-0 !text-xs !font-semibold'>{doc.paper.title}</p>
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
                    )}

                </div>
            </div>
        )
    }

const NoteListSessioned: React.FC<Props> = ({ workspaceId, learningSessionId }) => {
    const ionRouter = useIonRouter();
    const [presentToast] = useIonToast();
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [selectedNote, setSelectedNote] = useState<NoteTypes | null>(null);
    const [user, setUser] = useState({ id: '' });
    const [page, setPage] = useState(1);

    // RTK Query
    const [getNoteById] = useLazyGetNoteByIdQuery();
    const { data, isLoading, isFetching, isSuccess, isError } = useGetNotesByWorkspaceIdQuery({
        workspace_id: workspaceId,
        learning_session_id: learningSessionId,
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
    }, [learningSessionId]);

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
        await getNoteById({ id: item.id });
    }

    if (isLoading && page === 1) {
        return (
            <div className="ion-padding text-center ion-padding">
                <IonText className='text-center ion-padding text-sm'>Loading...</IonText>
            </div>
        );
    }

    if (isError) return (
        <div className='flex items-center justify-center ion-padding'>
            <IonText color="danger" className='text-sm'>Error loading notes</IonText>
        </div>
    );

    if (data?.notes?.length === 0) return (
        <div className='flex items-center justify-center ion-padding'>
            <IonText color="medium" className='ion-text-center text-sm'>
                Start your first note by select input method:
                Texting, Canvas, or File Upload above.
            </IonText>
        </div>
    );

    if (isError) return (
        <div className='flex items-center justify-center ion-padding'>
            <IonText color="danger" className='text-sm'>Error loading notes</IonText>
        </div>
    );

    return (
        <>
            <div id="notelist" className='flex flex-col gap-4 notes-list ion-padding mt-3'>
                {groupedNotes.map(({ dateKey, notes }) => (
                    <div key={dateKey} className='block flex flex-col w-full gap-4 relative'>
                        <div className='absolute left-[12px] top-6 bottom-2 border-l-1 border-dashed border-neutral-300'></div>

                        <div className='block'>
                            <IonText className='font-semibold text-neutral-800'>
                                <h3 className='!text-base !my-0'>
                                    {formatDateHeader(dateKey)}
                                </h3>
                            </IonText>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 xl:gap-5'>
                            {notes.map((item, index, array) => {
                                const isLast = index === array.length - 1;
                                return (
                                    <NoteItemMinimal
                                        key={item.id}
                                        item={item}
                                        user={user}
                                        isLast={isLast}
                                        workspaceId={workspaceId}
                                        learningSessionId={learningSessionId}
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
                            await NotesRepository.deleteNote(
                                selectedNote.id,
                                selectedNote.workspace_id,
                                selectedNote.learning_session_id || '',
                                selectedNote?.synced_id ? true : false,
                            );
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

export default NoteListSessioned;