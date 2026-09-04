import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonText } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { documentOutline, ellipsisVertical } from 'ionicons/icons';
import { useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';

interface Props {
    workspaceId: string;
}

const NoteItem: React.FC<{ item: NoteTypes }> = ({ item }) => {
    const { content_preview, created_at } = item;
    let editor: string = 'richtext';

    if (item.content_type == 'canvas') {
        editor = 'canvas';
    }

    return (
        <IonItem lines="none" className='ion-no-padding note-item'>
            <IonLabel>
                <div className='flex'>
                    <Link to={`/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}`} className='block w-full flex-1'>
                        <p className='flex gap-1 !m-0 items-center'>
                            <IonText className='text-sm text-neutral-500 uppercase'>{format(item.created_at, 'MMM dd, yy')}</IonText>
                            <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                            <IonText className='text-sm text-neutral-500 uppercase'>{format(item.created_at, 'HH:mm')}</IonText>
                            <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                            <IonIcon icon={documentOutline} className='text-sm text-neutral-500' />
                            <IonText className='text-sm text-neutral-500'>{item.pageCount?.[0]?.count || 0} page</IonText>
                        </p>
                        <IonText color="dark font-semibold">{item.user.name}</IonText>
                    </Link>

                    <div className='ml-auto'>
                        <IonButton shape='round' color={'medium'} fill='clear'>
                            <IonIcon icon={ellipsisVertical} slot='icon-only' />
                        </IonButton>
                    </div>
                </div>

                <Link to={`/dashboard/editor/${editor}?workspaceId=${item.workspace_id}&noteId=${item.id}`}>
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
    const [page, setPage] = useState(1);
    const { data, isLoading, isFetching } = useGetNotesByWorkspaceIdQuery({
        workspace_id: workspaceId,
        page,
        pageSize: 20,
    });

    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching && data && data.notes.length < data.count) {
            setPage((p) => p + 1);
        }
        (e.target as HTMLIonInfiniteScrollElement).complete();
    };

    if (isLoading) return <IonText className='text-center'>Loading...</IonText>;

    return (
        <IonList id="notelist" className='flex flex-col gap-6'>
            {data?.notes.map((item) => (
                <NoteItem key={item.id} item={item} />
            ))}
        </IonList>
    )
}

export default NoteList;