import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { chatbubblesOutline, chevronForwardOutline, ellipseOutline } from "ionicons/icons";
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
                <div className="flex-1">
                    <IonCardTitle className="text-base">{item.title}</IonCardTitle>
                    <IonCardSubtitle className="mt-1">
                        <div className="flex items-center flex-wrap gap-3">
                            <span className="text-sm">
                                {item.scope === 'personal' ? 'Personal' : 'Group'}
                            </span>
                            <IonText className='text-xs text-neutral-400'>&bull;</IonText>
                            {item.scope === 'group' && <span className="text-sm">{item.member_count} members</span>}
                            {item.today_note_count && item.today_note_count > 0 && (
                                <>
                                    <IonText className='text-xs text-neutral-400'>&bull;</IonText>
                                    <span className="text-sm text-green-700">{item.today_note_count} today's notes</span>
                                </>
                            )}
                        </div>
                    </IonCardSubtitle>
                </div>

                <div className="ml-auto">
                    <IonButton shape='round' size='small' color={'light'} routerDirection='none'>
                        <IonIcon icon={chevronForwardOutline} slot='icon-only' />
                    </IonButton>
                </div>
            </IonCardHeader>
        </IonCard>
    );
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ items }) => {
    return (
        <div className="!py-0 ion-padding flex flex-col gap-4">
            {items.length === 0 && <div className="ion-no-padding text-center">No workspaces found</div>}
            {items.map((item, index, array) => {
                const isLast = index === array.length - 1;
                return (
                    <WorkspaceItem key={index} item={item} isLast={isLast} />
                );
            })}
        </div>
    );
}

export default WorkspaceList;