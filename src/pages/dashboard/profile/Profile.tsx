import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonSpinner, IonText, IonTitle, IonToolbar } from "@ionic/react";
import { useGetCurrentUserQuery } from "../../../services/user";
import { diamondSharp } from "ionicons/icons";

const ProfilePage: React.FC = () => {
    const { data: userData, isFetching: isUserDataFetching } = useGetCurrentUserQuery();

    if (isUserDataFetching) {
        return (
            <IonPage>
                <IonContent color='light'>
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <IonSpinner name="crescent"></IonSpinner>
                            <div className="block">
                                <IonText>Please wait...</IonText>
                            </div>
                        </div>
                    </div>
                </IonContent>
            </IonPage>
        )
    }

    if (!userData) {
        return (
            <IonPage>
                <IonContent color='light'>
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <IonText>User not found</IonText>
                        </div>
                    </div>
                </IonContent>
            </IonPage>
        )
    }

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        {userData.name}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'} className="ion-padding">
                <IonItem lines="full" style={{ '--background': 'transparent', '--padding-bottom': '10px', '--padding-top': '10px' }}>
                    <IonLabel>
                        <p>ID</p>
                        <IonText className="text-neutral-600 font-semibold albert-font">{userData.id}</IonText>
                    </IonLabel>
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent', '--padding-bottom': '10px', '--padding-top': '10px' }}>
                    <IonLabel>
                        <p>Name</p>
                        <IonText className="text-neutral-600 font-semibold albert-font">{userData.name}</IonText>
                    </IonLabel>
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent', '--padding-bottom': '10px', '--padding-top': '10px' }}>
                    <IonLabel>
                        <p>Email</p>
                        <IonText className="text-neutral-600 font-semibold albert-font">{userData.email}</IonText>
                    </IonLabel>
                </IonItem>

                <IonItem lines="none" className="clear">
                    <IonLabel>
                        <p>Tokens balance</p>
                        <IonText className="text-neutral-600 font-semibold albert-font">{userData.token_balance}</IonText>
                    </IonLabel>

                    <div slot="end">
                        <IonButton
                            shape="round"
                            color="secondary"
                            mode="ios"
                            fill='solid'
                            style={{
                                'minHeight': '38px',
                                '--padding-start': '14px',
                                '--padding-end': '14px',
                            }}
                        >
                            <IonIcon icon={diamondSharp} className="mr-1 mt-0.5" />
                            <IonText>Get Free Tokens</IonText>
                        </IonButton>
                    </div>
                </IonItem>
            </IonContent>
        </IonPage>
    );
};

export default ProfilePage;