import { IonButton, IonIcon, IonText } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { documents, documentsOutline, ellipsisVertical } from 'ionicons/icons';
import { useState } from 'react';
import { NoteTypes, useGetNotesByWorkspaceIdQuery } from '../../services/notes';
import { Link } from 'react-router-dom';

interface Props {
    workspaceId: string;
}

const NoteItem: React.FC<{ item: NoteTypes }> = ({ item }) => {
    const { content_preview, created_at } = item;

    return (
        <Link to={`/dashboard/editor/richtext?workspaceId=${item.workspace_id}&noteId=${item.id}`}>
            <div className='block'>
                <div className='flex'>
                    <div className='flex flex-col'>
                        <div className='flex gap-1'>
                            <IonText className='text-xs text-neutral-500 uppercase'>{format(item.created_at, 'MMM dd, yy')}</IonText>
                            <IonText className='text-xs text-neutral-400'>&bull;</IonText>
                            <IonText className='text-xs text-neutral-500 uppercase'>{format(item.created_at, 'HH:mm')}</IonText>
                        </div>
                        <IonText className='text-base text-neutral-700 font-semibold'>{item.user.name}</IonText>
                    </div>

                    <div className='ml-auto'>
                        <IonButton shape='round' size='small' color={'medium'} fill='clear'>
                            <IonIcon icon={ellipsisVertical} slot='icon-only' />
                        </IonButton>
                    </div>
                </div>

                <div className='block'>
                    <div className='flex gap-2'>
                        <div className='flex items-center gap-1 text-green-600 text-base'>
                            <IonIcon icon={documentsOutline} color='success' className='text-lg' />
                            <IonText>{item.pageCount?.[0]?.count || 0} pages</IonText>
                        </div>
                    </div>

                    {content_preview && (
                        <div
                            dangerouslySetInnerHTML={{ __html: content_preview }}
                            className='text-neutral-700 text-base leading-6 mt-2 line-clamp-5'
                        />
                    )}
                </div>
            </div>
        </Link>
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
        <div id="notelist" className='flex flex-col gap-6'>
            {data?.notes.map((item) => (
                <NoteItem key={item.id} item={item} />
            ))}
        </div>
    )
}

export default NoteList;