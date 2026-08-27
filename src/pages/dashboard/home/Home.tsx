import { IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import StartNote from '../../../components/startnote/StartNote';
import TodayWorkspace from '../../../components/today-workspace/TodayWorkspace';

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

                <div className='ion-padding'>
                    <div className='block mb-3 text-lg'>
                        <IonText>Today at Workspaces</IonText>
                    </div>
                    <TodayWorkspace />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default HomePage;
