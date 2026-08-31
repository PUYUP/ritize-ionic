import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { chatbubblesOutline, ellipseOutline } from "ionicons/icons";
import type { WorkspaceItem } from "../../models/workspace";

interface WorkspaceListProps {
    items: WorkspaceItem[];
}

const WorkspaceItem: React.FC<{ item: WorkspaceItem }> = ({ item }) => {
    const { id, title, scope, memberCount, todayNoteCount } = item;

    return (
        <IonItem
            className="ion-no-padding"
            lines="none"
            detail={true}
            mode="ios"
            routerLink={`/dashboard/workspace/${id}?name=${title}`}
            routerDirection="forward"
        >
            <div slot="start" className="w-9 h-9 bg-neutral-100 rounded-full flex items-center justify-center">
                <IonIcon className="text-lg" icon={scope === 'personal' ? ellipseOutline : chatbubblesOutline} color={scope === 'personal' ? 'primary' : 'secondary'} />
            </div>
            <IonLabel className="ion-padding-start py-2">
                <h3 className="!mt-0 !text-base">{title}</h3>
                <p className="flex items-center flex-wrap gap-4">
                    {scope === 'group' && <span className="text-xs text-gray-500">{memberCount} members</span>}
                    {todayNoteCount > 0 && <span className="text-xs text-green-600">{todayNoteCount} today's notes</span>}
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