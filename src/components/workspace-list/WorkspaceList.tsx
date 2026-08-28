import { IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { albumsOutline, analyticsOutline, cafeOutline, chatbubbleOutline, chatbubblesOutline, ellipseOutline, peopleOutline, personOutline, schoolOutline, textOutline } from "ionicons/icons";

interface WorkspaceListProps { }

interface WorkspaceItemProps {
    title: string;
    icon?: string;
    color?: string;
    scope: 'personal' | 'group';
    memberCount: number;
    todayNoteCount: number;
}

const workspaces: WorkspaceItemProps[] = [
    {
        title: 'Fisika Dr. Hermawan',
        icon: 'text',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 1
    },
    {
        title: 'Psikologi Marketing Dra. Ernita',
        icon: 'analytics',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 2
    },
    {
        title: 'Kimia Dasar 2 Dr. Haryanti',
        icon: 'mic',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 0
    },
    {
        title: 'Fisika Teknik',
        icon: 'text',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 3
    },
    {
        title: 'Matematika Terapan',
        icon: 'analytics',
        color: '#EEE4FA',
        scope: 'group',
        memberCount: 5,
        todayNoteCount: 1
    },
    {
        title: 'Bahasa Arab',
        icon: 'mic',
        color: '#EEE4FA',
        scope: 'personal',
        memberCount: 1,
        todayNoteCount: 2
    },
];

const WorkspaceItem: React.FC<{ item: WorkspaceItemProps }> = ({ item }) => {
    const { title, scope, memberCount, todayNoteCount } = item;

    return (
        <IonItem className="ion-no-padding" lines="none" detail={true} mode="ios">
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