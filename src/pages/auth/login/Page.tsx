import {
    IonButton,
    IonContent,
    IonPage,
    IonHeader,
    IonToolbar,
    IonInput,
    IonText,
    IonSpinner,
    useIonRouter,
    IonButtons,
    IonBackButton,
} from '@ionic/react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from '../../../lib/supabase';
import { Preferences } from '@capacitor/preferences';

const LoginPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const { control, handleSubmit, reset, formState: { errors, isValid } } = useForm({
        mode: 'onChange',
        defaultValues: {
            email: '',
            password: '',
        }
    });

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        setErrorMsg('');

        try {
            const { data: user, error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                // Getting user from custom `user` table
                const { data: customUser, error: customUserError } = await supabase
                    .from('user')
                    .select('*')
                    .eq('auth_user_id', user.user?.id)
                    .single();

                const userData = {
                    id: customUser?.id,
                    email: customUser?.email,
                    name: customUser?.name,
                    session: user.session
                }

                await Preferences.set({
                    key: 'ritize_user',
                    value: JSON.stringify(userData)
                });
                // Reset form
                reset();

                // Success - redirect to home or dashboard
                setTimeout(() => {
                    ionRouter.push('/dashboard', 'forward', 'push');
                }, 500)
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot='start' className='ion-padding-start'>
                        <IonBackButton defaultHref='/'></IonBackButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <div className="flex flex-col justify-center h-full max-w-md mx-auto p-4">
                    <div className="text-center mb-8">
                        <h3 className='block ion-text-center !mb-2'>
                            <IonText className='text-sm uppercase text-neutral-600 tracking-widest'>
                                Welcome to Ritize
                            </IonText>
                        </h3>

                        <h1 className='block ion-text-center !mt-0 px-3'>
                            <IonText className='text-2xl font-bold'>
                                Login to Your Account
                            </IonText>
                        </h1>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Controller
                            name="email"
                            control={control}
                            rules={{
                                required: 'Email is required',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: 'Email is invalid'
                                }
                            }}
                            render={({ field }) => (
                                <div>
                                    <IonInput
                                        {...field}
                                        label="Email"
                                        labelPlacement="floating"
                                        fill="outline"
                                        type="email"
                                        placeholder="Enter your email"
                                        shape='round'
                                    />
                                    {errors.email && (
                                        <IonText color="danger" className="text-sm mt-1 block">
                                            {errors.email.message as string}
                                        </IonText>
                                    )}
                                </div>
                            )}
                        />

                        <Controller
                            name="password"
                            control={control}
                            rules={{
                                required: 'Password is required',
                                minLength: {
                                    value: 6,
                                    message: 'Password must be at least 6 characters long'
                                }
                            }}
                            render={({ field }) => (
                                <div>
                                    <IonInput
                                        {...field}
                                        label="Password"
                                        labelPlacement="floating"
                                        fill="outline"
                                        type="password"
                                        placeholder="Enter your password"
                                        shape='round'
                                    />
                                    {errors.password && (
                                        <IonText color="danger" className="text-sm mt-1 block">
                                            {errors.password.message as string}
                                        </IonText>
                                    )}
                                </div>
                            )}
                        />

                        {errorMsg && (
                            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                                {errorMsg}
                            </div>
                        )}

                        <IonButton
                            type="submit"
                            expand="block"
                            className="mt-6"
                            disabled={isLoading || !isValid}
                            mode='ios'
                            shape='round'
                        >
                            {isLoading ? <IonSpinner name="crescent" /> : 'Login'}
                        </IonButton>

                        <div className="text-center mt-6 flex items-center justify-center">
                            <IonText color="medium" className="text-sm">
                                Don't have an account?
                            </IonText>
                            <IonButton
                                routerLink="/register"
                                fill='clear'
                                mode='ios'
                                shape='round'
                                size='small'
                            >
                                Register
                            </IonButton>
                        </div>
                    </form>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default LoginPage;
