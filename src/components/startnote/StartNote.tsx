import { analyticsOutline, createOutline, documentOutline, imageOutline, listOutline, textOutline } from 'ionicons/icons';
import './StartNote.css';
import { IonCard, IonCardContent, IonCardTitle, IonIcon, IonText } from '@ionic/react';

interface StartNoteProps { }

const StartNote: React.FC<StartNoteProps> = () => {
    return (
        <div id="startnote">
            <div className='grid grid-cols-2 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent className='!flex flex-col items-center justify-center gap-2'>
                            <IonIcon icon={textOutline} className='text-3xl text-neutral-700' />
                            <IonText>Texting</IonText>
                        </IonCardContent>
                    </IonCard>
                </div>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/canvas' routerDirection='forward'>
                        <IonCardContent className='!flex flex-col items-center justify-center gap-2'>
                            <IonIcon icon={analyticsOutline} className='text-3xl text-neutral-700' />
                            <IonText>Freehand</IonText>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default StartNote;
