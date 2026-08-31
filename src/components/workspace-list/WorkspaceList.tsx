import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { chatbubblesOutline, ellipseOutline } from "ionicons/icons";
import type { OrganizationTypes } from "../../services/organization";

interface WorkspaceListProps {
    items: OrganizationTypes[];
}

const WorkspaceItem: React.FC<{ item: OrganizationTypes }> = ({ item }) => {
    return (
        <IonItem
            className="ion-no-padding"
            lines="none"
            detail={true}
            mode="ios"
            routerLink={`/dashboard/workspace/${item.id}?name=${item.name}`}
            routerDirection="forward"
        >
            <div slot="start" className="w-9 h-9 bg-neutral-100 rounded-full flex items-center justify-center">
                <IonIcon className="text-lg" icon={item.metadata.scope === 'personal' ? ellipseOutline : chatbubblesOutline} color={item.metadata.scope === 'personal' ? 'primary' : 'secondary'} />
            </div>
            <IonLabel className="ion-padding-start py-2">
                <h3 className="!mt-0 !text-base">{item.name}</h3>
                <p className="flex items-center flex-wrap gap-4">
                    {item.metadata.scope === 'group' && <span className="text-xs text-gray-500">{item.memberCount} members</span>}
                    {item.todayNoteCount && item.todayNoteCount > 0 && <span className="text-xs text-green-600">{item.todayNoteCount} today's notes</span>}
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