import { IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { albumsOutline, analyticsOutline, cafeOutline, chatbubbleOutline, chatbubblesOutline, ellipseOutline, peopleOutline, personOutline, schoolOutline, textOutline } from "ionicons/icons";

interface WorkspaceListProps { }

interface WorkspaceItemProps {
    readonly id: number;
    title: string;
    icon?: string;
    color?: string;
    scope: 'personal' | 'group';
    memberCount: number;
    todayNoteCount: number;
}

const workspaces: WorkspaceItemProps[] = [
    {
        id: 1,
        title: 'Fisika Dr. Hermawan',
        icon: 'text',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 1
    },
    {
        id: 2,
        title: 'Psikologi Marketing Dra. Ernita',
        icon: 'analytics',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 2
    },
    {
        id: 3,
        title: 'Kimia Dasar 2 Dr. Haryanti',
        icon: 'mic',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 0
    },
    {
        id: 4,
        title: 'Fisika Teknik',
        icon: 'text',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 3
    },
    {
        id: 5,
        title: 'Matematika Terapan',
        icon: 'analytics',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 1
    },
    {
        id: 6,
        title: 'Bahasa Arab',
        icon: 'mic',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 2
    },
];

const WorkspaceItem: React.FC<{ item: WorkspaceItemProps }> = ({ item }) => {
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

const WorkspaceList: React.FC<WorkspaceListProps> = () => {
    return (
        <IonList className="!py-0">
            {workspaces.map((workspace, index) => (
                <WorkspaceItem key={index} item={workspace} />
            ))}
        </IonList>
    );
}

export default WorkspaceList;