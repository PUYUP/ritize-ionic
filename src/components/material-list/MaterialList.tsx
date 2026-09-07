import { useEffect, useState } from 'react';
import { useGetLearningMaterialsQuery } from '../../services/workspace';
import './MaterialList.css';
import { IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSpinner, IonText } from '@ionic/react';
import { format } from 'date-fns';

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
            <IonList lines="full">
                {data?.results?.map((item: any, index: number, array) => {
                    const isLast = index === array.length - 1;

                    return (
                        <IonItem
                            key={item.id}
                            lines={isLast ? "none" : "full"}
                            detail={true}
                            href={item?.attributes?.file?.media_link}
                            target='_blank'
                            button
                        >
                            <div className='py-3'>
                                {item?.attributes?.file && (
                                    <IonLabel>
                                        {format(new Date(item.generated_date), 'dd MMMM yyyy')}
                                        <p>{item.attributes.file.extension?.toUpperCase()} • {(item.attributes.file.size_bytes / 1024).toFixed(1)} KB</p>
                                    </IonLabel>
                                )}
                            </div>
                        </IonItem>
                    )
                })}
            </IonList>

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
