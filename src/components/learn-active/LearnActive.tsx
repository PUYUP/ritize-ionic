import { IonCard, IonCardContent, IonIcon, IonText } from "@ionic/react";
import { useState } from "react";
import { LearningSessionTypes, useGetActiveLearningSessionsByUserIdQuery } from "../../services/learning.session";
import { timerOutline } from "ionicons/icons";
import { format } from "date-fns";

const LearnActiveItem: React.FC<{ item: LearningSessionTypes; isLast: boolean }> = ({ item, isLast }) => {
    return (
        <IonCard
            mode="md"
            routerLink={`/dashboard/workspace/${item.workspace_id}/sessions/${item.id}`}
            routerDirection="forward"
            className="rounded-xl clear"
        >
            <IonCardContent className="!px-2 lg:!px-0">
                <div className="flex items-center">
                    <div className="block flex-1">
                        <div className="text-lg mb-1">
                            <IonText className="text-neutral-800">
                                <h3 className="!mt-0 !mb-0 !text-[18px] !font-normal !leading-6 line-clamp-2">{item.workspace.title}</h3>
                            </IonText>
                        </div>

                        <div className="flex gap-4 items-center w-full text-xs">
                            <div className="flex gap-2 items-center">
                                <div className="flex gap-0.5 items-center">
                                    <IonIcon icon={timerOutline} className="mb-0.5" />
                                    <IonText>{format(item.started_at, 'EEEE, MMM dd yyyy')}</IonText>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ml-auto pl-2">
                        <div className="block w-20 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                            <div className="block w-full">
                                <div className="flex items-end justify-center oswald-font">
                                    <IonText className="text-lg font-semibold text-neutral-700">14</IonText>
                                </div>

                                <div className="text-xs line-clamp-1 w-full text-center">
                                    <IonText className="font-normal">hours ago</IonText>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </IonCardContent>
        </IonCard>
    );
}

const LearnActiveList: React.FC<{}> = ({ }) => {
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [page, setPage] = useState(1);
    const [user, setUser] = useState({ id: '' });

    const { data, isFetching, isLoading, isSuccess, isError } = useGetActiveLearningSessionsByUserIdQuery({
        page: page,
        pageSize: 20
    });

    if (isLoading && page === 1) {
        return (
            <div className="ion-padding text-center ion-padding">
                <IonText className='text-center ion-padding text-sm'>Loading...</IonText>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="ion-padding text-center ion-padding">
                <IonText className='text-center ion-padding text-sm'>No active sessions found.</IonText>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className='block divide-y-[1px] divide-neutral-200 divide-solid'>
                {data.results.map((item, index, array) => {
                    const isLast = index === array.length - 1;
                    return (
                        <div key={index} className='py-0'>
                            <LearnActiveItem item={item} isLast={isLast} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default LearnActiveList;
