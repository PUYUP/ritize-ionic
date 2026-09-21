import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import DigestVisibleThinkingList from '../../../components/digest-visible-thinking/DigestVisibleThinkingList';

const DigestsPage: React.FC = () => {
    const { name = 'Weekly Digests' } = useParams<{ name: string; }>();

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        {name}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'} className='ion-padding'>
                <DigestVisibleThinkingList />
            </IonContent>
        </IonPage>
    );
};

export default DigestsPage;