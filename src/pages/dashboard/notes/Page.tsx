import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import NoteList from '../../../components/note-list/NoteList';

const NotesPage: React.FC = () => {
    const { name = 'All Notes' } = useParams<{ name: string; }>();

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        {name}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <NoteList />
            </IonContent>
        </IonPage>
    );
};

export default NotesPage;