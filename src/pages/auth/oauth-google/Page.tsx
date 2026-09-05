import { IonButton, IonContent, IonPage, IonSpinner, IonText, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { useState } from 'react';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import CryptoJS from 'crypto-js';
import { supabase } from '../../../lib/supabase';

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

const generateNonce = () => {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
};

const sha256 = async (message: string) => {
    return CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
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

            // Cek apakah berjalan di Native (iOS / Android)
            const isNative = Capacitor.isNativePlatform();

            let rawNonce: string | undefined = undefined;
            let loginOptions: any = {
                scopes: ['profile', 'email'],
            };

            // Jika bukan native (misal Web), kita aman menggunakan nonce.
            // Jika native, kosongkan nonce agar tidak mismatch dengan Google SDK.
            if (!isNative) {
                rawNonce = generateNonce();
                const hashedNonce = await sha256(rawNonce);
                loginOptions.nonce = hashedNonce;
            }

            // 1. Panggil Social Login dengan opsi kondisional
            const res = await SocialLogin.login({
                provider: 'google',
                options: loginOptions,
            });

            setStatus(Status.OAUTH_GOOGLE_SUCCESS);

            if (
                res &&
                res.provider == 'google' &&
                res.result.responseType == 'online' &&
                res.result.idToken
            ) {
                console.log("Google OAuth Response", res);

                // 2. Kirim ke Supabase dengan menyertakan nonce HANYA jika ada
                const signInPayload: any = {
                    provider: 'google',
                    token: res.result.idToken,
                };

                if (rawNonce) {
                    signInPayload.nonce = rawNonce;
                }

                const { data, error } = await supabase.auth.signInWithIdToken(signInPayload);

                if (error) throw error;

                console.log("supabase.auth.signInWithIdToken Response", data);

                // save user
                if ('user' in data && data.user) {
                    await Preferences.set({
                        key: 'ritize_user',
                        value: JSON.stringify(data.user.user_metadata)
                    });

                    if (data.session) {
                        await Preferences.set({
                            key: 'ritize_session',
                            value: JSON.stringify(data.session),
                        });
                    }

                    // update name inside user table
                    const { data: userData, error: userError } = await supabase
                        .from('user')
                        .upsert({
                            name: data.user.user_metadata.full_name,
                            email: data.user.user_metadata.email,
                        }, { onConflict: 'email' })
                        .select()
                        .single();

                    if (userData) {
                        await Preferences.set({
                            key: 'ritize_user',
                            value: JSON.stringify(userData)
                        });
                    }
                }

                // redirect to dashboard
                setTimeout(() => {
                    ionRouter.push('/dashboard', 'forward', 'push');
                    setStatus(Status.SIGNIN_SUCCESS);
                }, 2000);
            } else {
                throw new Error("Invalid Google Login Response");
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