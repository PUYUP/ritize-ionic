import { IonButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonText } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { attachOutline, documentOutline, ellipsisVertical, shapesOutline, textOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';
import { getUser } from '../../utils/authState';

interface Props {
    workspaceId: string;
}

const NoteItem: React.FC<{ item: NoteTypes, user: { id: string } }> = ({ item, user }) => {
    const { content_preview, created_at } = item;
    let editor: string = 'richtext';

    if (item.content_type == 'canvas') {
        editor = 'canvas';
    } else if (item.content_type == 'file') {
        editor = 'file';
    }

    let linkTo: string = `/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}`;

    // if not creator view the note as normal viewer
    if (item.user.id !== user.id) {
        linkTo = `/dashboard/workspace/note-viewer?workspaceId=${item.workspace_id}&noteId=${item.id}`;
    }

    return (
        <IonItem lines="none" className='ion-no-padding note-item'>
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
                                <IonText className='text-sm text-neutral-500'>{item.pageCount?.[0]?.count || 0} page</IonText>
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

    if (isLoading && page === 1) return <IonText className='text-center'>Loading...</IonText>;

    return (
        <>
            <IonList id="notelist" className='flex flex-col gap-6'>
                {data?.notes.map((item) => (
                    <NoteItem key={item.id} item={item} user={user} />
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