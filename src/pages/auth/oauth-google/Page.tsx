import { IonButton, IonContent, IonPage, IonSpinner, IonText, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { useState } from 'react';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { authClient } from '../../../utils/authClient';
import { Preferences } from '@capacitor/preferences';

const enum Status {
    INIT = "init",
    LOADING = "loading",
    OAUTH_GOOGLE = "oauth-google",
    OAUTH_GOOGLE_SUCCESS = "oauth-google-success",
    OAUTH_GOOGLE_FAIL = "oauth-google-fail",
    SIGNIN_SUCCESS = "signin-success",
    SIGNIN_FAIL = "signin-fail",
    ERROR = "error",
}

// 1. Generate Raw Nonce
const generateNonce = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ('0' + dec.toString(16)).slice(-2)).join('');
};

// 2. Create a SHA-256 Hash Function
const sha256 = async (message: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const OAuthGooglePage: React.FC = () => {
    const ionRouter = useIonRouter();
    const [status, setStatus] = useState<Status>(Status.LOADING);

    useIonViewDidEnter(() => {
        window.dispatchEvent(new Event('resize'));
        (async () => {
            performLogin();
        })();
    });

    const performLogin = async () => {
        try {
            setStatus(Status.LOADING);

            // Generate the raw nonce
            const rawNonce = generateNonce();

            // Hash the nonce
            const hashedNonce = await sha256(rawNonce);

            // 1. Pass the HASHED nonce to Google via Capgo
            const res = await SocialLogin.login({
                provider: 'google',
                options: {
                    scopes: ['profile', 'email'],
                    nonce: hashedNonce,
                },
            });

            setStatus(Status.OAUTH_GOOGLE_SUCCESS);

            if (
                res &&
                res.provider == 'google' &&
                res.result.responseType == 'online' &&
                res.result.idToken
            ) {
                console.log("Google OAuth Response", res);

                const { data, error } = await authClient.signIn.social({
                    provider: "google",
                    disableRedirect: true,
                    idToken: {
                        token: res.result.idToken,
                        accessToken: res.result.accessToken?.token,
                    }
                });

                if (error) throw error;

                console.log("authClient.signIn.social Response", data);

                // save user
                if ('user' in data) {
                    await Preferences.set({
                        key: 'ritize_user',
                        value: JSON.stringify(data.user)
                    });
                }

                // redirect to dashboard
                setTimeout(() => {
                    ionRouter.push('/dashboard', 'forward', 'push');
                    setStatus(Status.SIGNIN_SUCCESS);
                }, 2000);

            }
        } catch (error) {
            console.error(error);
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