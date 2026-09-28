import { IonButton, IonContent, IonIcon, IonPage, IonText } from '@ionic/react';
import './TokenRewardSuccess.css';
import { useSearchParams } from 'react-router-dom';
import { diamondSharp } from 'ionicons/icons';

const TokenRewardSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const newToken = searchParams.get('new') ?? 0;
    const balanced = searchParams.get('balanced') ?? 0;

    return (
        <IonPage>
            <IonContent color={'light'} className="ion-padding">
                <div className="w-full h-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    <div className='flex h-full w-full justify-center items-center'>
                        <div className='text-center flex flex-col items-center justify-center'>
                            <div className='flex flex-col justify-center items-center'>
                                <IonIcon icon={diamondSharp} className='text-6xl text-purple-600 animate-bounce' />
                                <div className='flex flex-col w-28 h-28 bg-white rounded-full shadow-lg flex items-center justify-center -mt-8 border-4 border-neutral-100'>
                                    <IonText className='oswald-font text-3xl text-purple-500 font-bold mt-4'>+{newToken}</IonText>
                                    <IonText className='text-xs text-neutral-400 mt-0.5'>raised</IonText>
                                </div>
                            </div>
                            <div className='flex flex-col justify-center items-center mt-6'>
                                <IonText className='uppercase tracker-wider text-sm text-neutral-600 albert-font !font-normal'>Token Balance</IonText>
                                <IonText className='albert-font text-2xl font-bold text-green-600'>{balanced}</IonText>
                            </div>

                            <div className='text-center mt-6'>
                                <IonButton routerLink='/dashboard' shape='round' mode='ios' fill='clear'>
                                    Back to home
                                </IonButton>
                            </div>
                        </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    )
};

export default TokenRewardSuccessPage;