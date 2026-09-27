import { IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonText } from "@ionic/react";
import { documentTextOutline, peopleOutline } from "ionicons/icons";
import { WorkspaceTypes } from "../../services/workspace";
import './WorkspaceList.css';
import { format, intervalToDuration } from "date-fns";

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
        <>
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
                                        <IonText className="text-lg font-semibold text-neutral-700">{totalHours}</IonText>
                                        <IonText className="text-[14px] !font-normal text-neutral-500 pb-[1px]">.{minutes}h</IonText>
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

            {item.sessions && item.sessions?.length > 0 && (
                <div className="mb-3 px-2">
                    <div className="mb-2 flex gap-2 items-center">
                        <span className="w-4 h-4 bg-white rounded-xl text-xs flex items-center justify-center shadow-md">{item.sessions?.length}</span>
                        <span className="text-sm albert-font text-neutral-600 !font-normal">Active sessions</span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {item.sessions.map(ses => {
                            const duration = intervalToDuration({
                                start: ses.started_at,
                                end: new Date(),
                            });

                            const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
                            const minutes = duration.minutes ?? 0;

                            return (
                                <IonItem
                                    key={ses.id}
                                    className="clearx !bg-transparent !pl-0 rounded-xl shadow"
                                    lines="none"
                                    routerLink={`/dashboard/workspace/${item.id}/sessions/${ses.id}`}
                                    detail={true}
                                    button={true}
                                    style={{
                                        '--background': '#ede5c3',
                                        '--border-width': '1px',
                                        '--border-radius': '0.75rem',
                                    }}
                                >
                                    <IonLabel>
                                        <IonText className="text-sm text-neutral-700">{format(ses.started_at, 'EEEE, MMM dd yyyy')}</IonText>
                                    </IonLabel>

                                    <div slot="end" className="flex gap-1.5 text-sm text-[#9d9678]">
                                        <span className="oswald-font text-neutral-600">{totalHours}.{minutes}</span>
                                        <span>hours ago</span>
                                    </div>
                                </IonItem>
                            )
                        })}
                    </div>
                </div>
            )}
        </>
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