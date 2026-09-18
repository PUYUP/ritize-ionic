import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { chatbubblesOutline, chevronForwardOutline, ellipseOutline, people, peopleOutline } from "ionicons/icons";
import { WorkspaceTypes } from "../../services/workspace";
import './WorkspaceList.css';

interface WorkspaceListProps {
    items: WorkspaceTypes[];
}

const WorkspaceItem: React.FC<{ item: WorkspaceTypes; isLast: boolean }> = ({ item, isLast }) => {
    return (
        <IonCard
            mode="md"
            routerLink={`/dashboard/workspace/${item.id}`}
            routerDirection="forward"
            className="rounded-xl"
        >
            <IonCardHeader className="ion-padding flex flex-row">
                <div className="flex-1 pr-2">
                    <IonCardTitle className="text-lg">
                        <IonText className="font-semibold">
                            <h3 className="!mt-0 !mb-0 !text-lg !font-semibold !leading-6">{item.title}</h3>
                        </IonText>
                    </IonCardTitle>
                </div>

                <div className="ml-auto">
                    <IonButton shape='round' size='small' color={'light'} routerDirection='none'>
                        <IonIcon icon={chevronForwardOutline} slot='icon-only' />
                    </IonButton>
                </div>
            </IonCardHeader>

            <IonCardContent className="ion-padding !px-4 !pt-0 -mt-2">
                <table className="table text-sm w-full">
                    <tbody>
                        <tr className="border-b border-neutral-200">
                            <td className="w-26 !py-0.5">Type</td>
                            <td className="flex gap-1">
                                :
                                <div className="flex gap-2 items-center w-full">
                                    <IonText className="text-sm min-w-6">
                                        {item.scope === 'personal' ? 'Personal' : 'Group'}
                                    </IonText>
                                    {item.scope === 'group' && item.member_count != 0 && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <IonIcon icon={people} className='text-base text-neutral-400'></IonIcon>
                                            <IonText className="text-neutral-600 text-xs font-semibold">{item.member_count}</IonText>
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>

                        <tr className="border-b border-neutral-200">
                            <td className="w-26 !py-0.5">Notes</td>
                            <td className="flex gap-1">
                                :
                                <div className="flex gap-2 items-center w-full">
                                    <IonText className="text-sm min-w-6">{item.total_note_count}</IonText>
                                    <div className="ml-auto">
                                        {item.today_note_count != 0 &&
                                            <IonText className="text-green-500 text-xs font-semibold">{item.today_note_count} today</IonText>
                                        }
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="w-26 !py-0.5">Materials</td>
                            <td className="flex gap-1">
                                :
                                <div className="flex gap-2 items-center w-full">
                                    <IonText className="text-sm min-w-6">{item.total_material_count}</IonText>
                                    <div className="ml-auto">
                                        {item.today_material_count != 0 &&
                                            <IonText className="text-green-500 text-xs font-semibold">{item.today_material_count} today</IonText>
                                        }
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </IonCardContent>
        </IonCard>
    );
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ items }) => {
    return (
        <div className="!py-0 ion-padding flex flex-col gap-4">
            {items.length === 0 && <div className="ion-no-padding text-center">No workspaces found</div>}
            <div className='grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 xl:gap-5'>
                {items.map((item, index, array) => {
                    const isLast = index === array.length - 1;
                    return (
                        <WorkspaceItem key={index} item={item} isLast={isLast} />
                    );
                })}
            </div>
        </div>
    );
}

export default WorkspaceList;