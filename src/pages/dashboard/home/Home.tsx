import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import StartNote from '../../../components/startnote/StartNote';
import TodayWorkspace from '../../../components/today-workspace/TodayWorkspace';
import WorkspaceList from '../../../components/workspace-list/WorkspaceList';
import { addCircleOutline, addOutline } from 'ionicons/icons';

const HomePage: React.FC = () => {
    const { name = '' } = useParams<{ name: string; }>();

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonMenuButton />
                    </IonButtons>
                    <IonTitle>{name}</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen>
                <div className='ion-padding'>
                    <div className='block mb-1 leading-3 text-lg'>
                        <IonText>Good Morning, <strong>Rahman</strong></IonText>
                    </div>
                    <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Start lecture notes</IonText>
                    </div>
                    <StartNote />
                </div>

                <div className='ion-padding !pb-2'>
                    <div className='block mb-3 text-lg'>
                        <IonText>Happening Today</IonText>
                    </div>
                    <TodayWorkspace />
                </div>

                <div className='ion-padding !pr-1'>
                    <div className='block mb-3 text-lg flex items-center justify-between'>
                        <IonText>My Workspaces</IonText>
                        <IonButton fill="clear" aria-label='Add workspace' routerLink={'/dashboard/editor/workspace'}>
                            <IonIcon icon={addCircleOutline} className='text-2xl' />
                        </IonButton>
                    </div>
                    <WorkspaceList />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default HomePage;
