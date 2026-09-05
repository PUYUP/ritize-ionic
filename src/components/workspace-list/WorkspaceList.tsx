import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { chatbubblesOutline, ellipseOutline } from "ionicons/icons";
import { WorkspaceTypes } from "../../services/workspace";
import './WorkspaceList.css';

interface WorkspaceListProps {
    items: WorkspaceTypes[];
}

const WorkspaceItem: React.FC<{ item: WorkspaceTypes }> = ({ item }) => {
    return (
        <IonItem
            className="ion-no-padding workspace-item"
            lines="none"
            detail={true}
            mode="ios"
            routerLink={`/dashboard/workspace/${item.id}`}
            routerDirection="forward"
        >
            <div slot="start" className="w-9 h-9 bg-neutral-100 rounded-full flex items-center justify-center">
                <IonIcon className="text-xl" icon={item.scope === 'personal' ? ellipseOutline : chatbubblesOutline} color={item.scope === 'personal' ? 'primary' : 'dark'} />
            </div>
            <IonLabel className="ion-padding-start py-2">
                <h3 className="!mt-0 !mb-1 !text-lg leading-6">{item.title}</h3>
                <p className="flex items-center flex-wrap gap-4">
                    {item.scope === 'group' && <span className="text-sm text-gray-500">{item.member_count} members</span>}
                    {item.today_note_count && item.today_note_count > 0 && <span className="text-sm text-green-600">{item.today_note_count} today's notes</span>}
                </p>
            </IonLabel>
        </IonItem>
    );
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ items }) => {
    return (
        <IonList className="!py-0">
            {items.length === 0 && <IonItem className="ion-no-padding" lines="none">No workspaces found</IonItem>}
            {items.map((item, index) => (
                <WorkspaceItem key={index} item={item} />
            ))}
        </IonList>
    );
}

export default WorkspaceList;