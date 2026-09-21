import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonPage, IonText, IonTitle, IonToolbar, useIonToast, IonSpinner } from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import { warningOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from '../../../lib/supabase';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../utils/authContext';

const AccountDeletionPage: React.FC = () => {
    const { name = 'Delete Account' } = useParams<{ name: string; }>();
    const [present] = useIonToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { logout } = useAuth();

    const { control, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: {
            email: ''
        }
    });

    useEffect(() => {
        if (isSubmitted) {
            const timer = setTimeout(() => {
                logout();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isSubmitted, logout]);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('account_deletion_requests').insert([{ email: data.email }]);

            if (error) {
                present({
                    message: error.message,
                    duration: 3000,
                    color: 'danger'
                });
            } else {
                setIsSubmitted(true);
            }
        } catch (err: any) {
            present({
                message: err.message || 'An error occurred',
                duration: 3000,
                color: 'danger'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    {!isSubmitted && (
                        <IonButtons slot="start" className="ion-padding-start">
                            <IonBackButton defaultHref="/dashboard" />
                        </IonButtons>
                    )}
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        {name}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'} className='ion-padding'>
                <div className='h-full w-full flex items-center justify-center pb-20'>
                    {isSubmitted ? (
                        <div className='flex flex-col items-center mb-20 xl:w-3/6 2xl:w-2/6 mx-auto px-4'>
                            <IonIcon aria-hidden="true" icon={checkmarkCircleOutline} color="success" className='w-24 h-24' />
                            <IonText className='text-2xl font-bold mt-4'>Request Received</IonText>
                            <IonText className='text-sm text-center mt-2'>
                                Your account deletion request has been submitted successfully. We will contact you shortly to confirm this request.
                            </IonText>
                            <IonText className='text-sm text-center mt-8 text-neutral-500'>
                                You will be logged out automatically in a few seconds...
                            </IonText>
                            <IonButton expand="block" fill="clear" className="mt-4" onClick={() => logout()}>
                                Log out now
                            </IonButton>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col items-center mb-20 xl:w-3/6 2xl:w-2/6 mx-auto'>
                            <IonIcon aria-hidden="true" slot="start" icon={warningOutline} color="danger" className='w-24 h-24' />
                            <IonText className='text-2xl font-bold'>Delete Account</IonText>
                            <IonText className='text-sm text-center mt-2'>
                                Are you sure you want to delete your account? All related content will permanently be deleted.
                            </IonText>

                            <div className='mt-5 w-full'>
                                <Controller
                                    name="email"
                                    control={control}
                                    rules={{
                                        required: 'Email is required',
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: "Invalid email address"
                                        }
                                    }}
                                    render={({ field }) => (
                                        <IonInput
                                            {...field}
                                            label="Enter your email*"
                                            className={`w-full ${errors.email ? 'ion-invalid' : ''}`}
                                            labelPlacement='floating'
                                            fill="outline"
                                            errorText={errors.email?.message as string}
                                            onIonInput={(e) => field.onChange(e.detail.value)}
                                        />
                                    )}
                                />
                            </div>

                            <IonButton type="submit" expand="block" color="danger" className="mt-6 w-full" shape='round' disabled={isLoading}>
                                {isLoading ? <IonSpinner name="crescent" /> : 'Delete Account'}
                            </IonButton>
                        </form>
                    )}
                </div>
            </IonContent>
        </IonPage>
    );
};

export default AccountDeletionPage;