import { analyticsOutline, createOutline, documentOutline, imageOutline, listOutline, micOutline, textOutline } from 'ionicons/icons';
import './StartNote.css';
import { IonCard, IonCardContent, IonCardTitle, IonIcon, IonText } from '@ionic/react';

interface StartNoteProps {
    workspace?: {
        id?: number;
    }
}

const StartNote: React.FC<StartNoteProps> = ({ workspace }) => {
    const workspaceId = workspace?.id

    return (
        <div id="startnote">
            <div className='grid grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/richtext${workspaceId ? `?workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='w-8 h-8 flex items-center justify-center bg-[#E1F2F1] rounded-full mb-3'>
                                <IonIcon icon={textOutline} className='text-xl text-[#008C88]' />
                            </div>

                            <div className='block mt-0 mb-0'>
                                <IonText className="font-semibold text-sm text-neutral-700">Texting</IonText>
                            </div>

                            <div className='block leading-3'>
                                <IonText className='text-xs line-clamp-1'>
                                    Keyboard device
                                </IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/canvas${workspaceId ? `?workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='w-8 h-8 flex items-center justify-center bg-[#E9F4E5] rounded-full mb-3'>
                                <IonIcon icon={analyticsOutline} className='text-xl text-[#32A315]' />
                            </div>

                            <div className='block mt-0 mb-0'>
                                <IonText className="font-semibold text-sm text-neutral-700">Freehand</IonText>
                            </div>

                            <div className='block leading-2'>
                                <IonText className='text-xs line-clamp-1'>
                                    Stylus or finger
                                </IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/voice${workspaceId ? `?workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='w-8 h-8 flex items-center justify-center bg-[#EEE4FA] rounded-full mb-3'>
                                <IonIcon icon={micOutline} className='text-xl text-[#5B00C9]' />
                            </div>

                            <div className='block mt-0 mb-0'>
                                <IonText className="font-semibold text-sm text-neutral-700">Audio</IonText>
                            </div>

                            <div className='block leading-3 line-clamp-1'>
                                <IonText className='text-xs line-clamp-1'>
                                    Listen lecture
                                </IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default StartNote;
