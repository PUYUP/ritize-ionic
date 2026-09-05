import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonImg, IonMenuButton, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import { logoGoogle, mailOutline } from 'ionicons/icons';

const Page: React.FC = () => {
  const { name = '' } = useParams<{ name: string; }>();

  return (
    <IonPage>
      <IonContent className='ion-padding' fullscreen>
        <div className='flex flex-col w-full h-full'>
          <div className='block ion-tcenter mt-auto mb-4'>
            <IonImg className='w-32 h-32 mx-auto' src='/icons/notes.png'></IonImg>
          </div>

          <div className='block mt-auto'>
            <h3 className='block ion-text-center !mb-2'>
              <IonText className='text-sm uppercase text-neutral-600 tracking-widest'>
                Welcome to Ritize
              </IonText>
            </h3>

            <h1 className='block ion-text-center !mt-0 px-3'>
              <IonText className='text-2xl font-bold'>
                Exchange lecture notes to assist studies every day.
              </IonText>
            </h1>

            <div className='block text-center mt-8 mb-6'>
              <div className='block text-center'>
                <IonButton
                  routerLink="/oauth-google"
                  color={'dark'}
                  mode={'ios'}
                  shape='round'
                  className='items-center gap-3'
                >
                  <IonIcon slot='start' icon={logoGoogle} />
                  <IonText className='ml-2'>Continue with Google</IonText>
                </IonButton>
              </div>

              {/* <div className='block text-center mt-4'>
                <IonButton color={'primary'} fill="clear" mode={'ios'} shape='round' className='items-center gap-3'>
                  <IonIcon slot='start' icon={mailOutline} />
                  <IonText className='ml-2'>Use an Email</IonText>
                </IonButton>
              </div> */}
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Page;
