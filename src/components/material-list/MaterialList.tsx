import { useEffect, useState } from 'react';
import { useGetLearningMaterialsQuery } from '../../services/workspace';
import './MaterialList.css';
import { IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSpinner, IonText } from '@ionic/react';
import { format } from 'date-fns';
import { chevronForwardOutline } from 'ionicons/icons';

type Props = {
    workspaceId?: string;
}

const MaterialList: React.FC<Props> = ({ workspaceId }) => {
    const [page, setPage] = useState(1);
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const { data, isLoading, isFetching, isSuccess, isError } = useGetLearningMaterialsQuery({
        workspace_id: workspaceId,
        page: page,
        pageSize: 20,
    });

    const hasMore = (data?.results.length ?? 0) < (data?.count ?? 0);
    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching && hasMore) {
            setPage((p) => p + 1);
            console.log("page: ", page);
        }

        setIonScrollEl(e.target as HTMLIonInfiniteScrollElement);
    };

    useEffect(() => {
        if (isSuccess && !isFetching) {
            ionScrollEl?.complete();
        }
    }, [isSuccess, isFetching]);

    if (isLoading) return (
        <div className='flex items-center justify-center h-full'>
            <IonSpinner name="crescent"></IonSpinner>
        </div>
    );

    if (isError) return (
        <div className='flex items-center justify-center h-full'>
            <IonText color="danger">Error loading materials</IonText>
        </div>
    );

    if (!data) return (
        <div className='flex items-center justify-center h-full'>
            <IonText color="medium">No materials found</IonText>
        </div>
    );

    if (data.results.length === 0) return (
        <div className='flex items-center justify-center h-full'>
            <IonText color="medium">No materials found</IonText>
        </div>
    );

    return (
        <>
            <div className='block w-full flex flex-col gap-4'>
                {data?.results?.map((item: any, index: number, array) => {
                    return (
                        <IonCard
                            key={item.id}
                            className='rounded-xl'
                            href={item?.attributes?.file?.media_link}
                            target='_blank'
                        >
                            <IonCardHeader className="ion-padding flex flex-row">
                                {item?.attributes?.file && (
                                    <>
                                        <div className="flex-1">
                                            <IonCardTitle className='text-lg'>
                                                {format(new Date(item.generated_date), 'dd MMMM yyyy')}
                                            </IonCardTitle>

                                            <IonCardSubtitle className="mt-1">
                                                <div className="flex items-center flex-wrap gap-3">
                                                    <span className="text-sm">{item.attributes.file.extension?.toUpperCase()}</span>
                                                    <IonText className='text-xs text-neutral-400'>&bull;</IonText>
                                                    <span className="text-sm">{(item.attributes.file.size_bytes / 1024).toFixed(1)} KB</span>
                                                </div>
                                            </IonCardSubtitle>
                                        </div>

                                        <div className="ml-auto">
                                            <IonButton shape='round' size='small' color={'light'} routerDirection='none'>
                                                <IonIcon icon={chevronForwardOutline} slot='icon-only' />
                                            </IonButton>
                                        </div>
                                    </>
                                )}
                            </IonCardHeader>
                        </IonCard>
                    )
                })}
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
        </>
    );
}

export default MaterialList;
