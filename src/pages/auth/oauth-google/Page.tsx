import { IonButton, IonContent, IonPage, IonSpinner, IonText, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { useState } from 'react';
import { SocialLogin } from '@capgo/capacitor-social-login';

const enum Status {
    INIT = "init",
    LOADING = "loading",
    OAUTH_GOOGLE = "oauth-google",
    OAUTH_GOOGLE_SUCCESS = "oauth-google-success",
    OAUTH_GOOGLE_FAIL = "oauth-google-fail",
    ERROR = "error",
}

const OAuthGooglePage: React.FC = () => {
    const [status, setStatus] = useState<Status>(Status.LOADING);

    useIonViewDidEnter(() => {
        window.dispatchEvent(new Event('resize'));
        console.log('OAuthGooglePage loaded');

        (async () => {
            performLogin();
        })()
    });

    const performLogin = async () => {
        try {
            setStatus(Status.LOADING);
            const result = await SocialLogin.login({
                provider: 'google',
                options: { scopes: ['profile', 'email'] },
            });

            console.log(result);
            setStatus(Status.OAUTH_GOOGLE_SUCCESS);
        } catch (error) {
            setStatus(Status.ERROR);
        }
    }

    return (
        <IonPage>
            <IonContent fullscreen className='ion-padding'>
                {status === Status.LOADING && (
                    <div className='flex h-full items-center justify-center'>
                        <div className='flex gap-4 items-center'>
                            <IonSpinner></IonSpinner>
                            <IonText>Process google authentication...</IonText>
                        </div>
                    </div>
                )}

                {status === Status.ERROR && (
                    <div className='flex h-full items-center justify-center px-6'>
                        <div className='flex flex-col gap-4 items-center'>
                            <IonText className='ion-text-center text-lg'>Failed to process google authentication, please try again.</IonText>
                            <IonButton shape='round' mode='ios' onClick={async () => await performLogin()}>
                                Try Again
                            </IonButton>
                        </div>
                    </div>
                )}

                {status === Status.OAUTH_GOOGLE_SUCCESS && (
                    <div className='flex h-full items-center justify-center px-6 pb-10'>
                        <div className='flex flex-col gap-4 items-center'>
                            <IonSpinner></IonSpinner>
                            <IonText className='ion-text-center text-lg'>Google authentication successful, please wait... Preparing your account...</IonText>
                        </div>
                    </div>
                )}
            </IonContent>
        </IonPage>
    )
}

export default OAuthGooglePage;