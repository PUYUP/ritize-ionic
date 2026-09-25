import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { chatbubblesOutline, chevronForwardOutline, documentTextOutline, ellipseOutline, people, peopleOutline, timeOutline } from "ionicons/icons";
import { WorkspaceTypes } from "../../services/workspace";
import './WorkspaceList.css';
import { intervalToDuration } from "date-fns";

interface WorkspaceListProps {
    items: WorkspaceTypes[];
}

const WorkspaceItem: React.FC<{ item: WorkspaceTypes; isLast: boolean }> = ({ item, isLast }) => {
    const duration = intervalToDuration({
        start: 0,
        end: (item.total_duration_seconds ?? 0) * 1000 // intervalToDuration expects milliseconds
    });

    // Kalikan hari dengan 24 dan tambahkan ke sisa jam
    const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
    const minutes = duration.minutes ?? 0;

    return (
        <IonCard
            mode="md"
            routerLink={`/dashboard/workspace/${item.id}`}
            routerDirection="forward"
            className="rounded-xl clear"
        >
            <IonCardContent className="!px-2 lg:!px-0">
                <div className="flex items-center">
                    <div className="block flex-1">
                        <div className="text-lg mb-1">
                            <IonText className="text-neutral-800">
                                <h3 className="!mt-0 !mb-0 !text-[18px] !font-normal !leading-6 line-clamp-2">{item.title}</h3>
                            </IonText>
                        </div>

                        <div className="flex gap-4 items-center w-full text-xs">
                            <div className="flex gap-2 items-center">
                                <div className="flex gap-0.5 items-center">
                                    <IonIcon icon={documentTextOutline} className="mb-0.5" />
                                    <IonText>{item.total_note_count}</IonText>
                                    <IonText className="text-neutral-500">notes</IonText>
                                </div>

                                <div className="block">
                                    {item.today_note_count != 0 &&
                                        <IonText className="text-green-600">{item.today_note_count} today</IonText>
                                    }
                                </div>
                            </div>

                            {item.scope === 'group' && item.member_count != 0 && (
                                <div className="flex items-center gap-2">
                                    <IonIcon icon={peopleOutline} className='text-base text-neutral-400'></IonIcon>

                                    <div className="flex gap-0.5">
                                        <IonText>{item.member_count}</IonText>
                                        <IonText className="text-neutral-500">mates</IonText>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ml-auto pl-2">
                        <div className="block w-20 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                            <div className="block w-full">
                                <div className="flex items-end justify-center oswald-font">
                                    <IonText className="text-lg font-semibold text-green-600">{totalHours}</IonText>
                                    <IonText className="text-[14px] !font-normal text-green-500 pb-[1px]">.{minutes}h</IonText>
                                </div>

                                <div className="text-xs line-clamp-1 w-full text-center">
                                    <IonText className="font-bold ml-0.5">{item.total_session_count}</IonText>
                                    <IonText className="ml-0.5">sess</IonText>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </IonCardContent>
        </IonCard>
    );
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ items }) => {
    return (
        <div className="flex flex-col gap-4">
            {items.length === 0 && <div className="ion-no-padding text-center">No workspaces found</div>}
            <div className='block divide-y-[1px] divide-neutral-200 divide-solid'>
                {items.map((item, index, array) => {
                    const isLast = index === array.length - 1;
                    return (
                        <div key={index} className='py-0'>
                            <WorkspaceItem item={item} isLast={isLast} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default WorkspaceList;