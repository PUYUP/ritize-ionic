import { analyticsOutline, cloudUploadOutline, documentAttachOutline, fileTrayOutline, imageOutline, imagesOutline, micOutline, shapesOutline, textOutline } from 'ionicons/icons';
import './StartNote.css';
import { IonCard, IonCardContent, IonIcon, IonText } from '@ionic/react';

interface StartNoteProps {
    workspace?: {
        id?: string;
        languageCode?: string;
    }
}

const StartNote: React.FC<StartNoteProps> = ({ workspace }) => {
    const workspaceId = workspace?.id
    const languageCode = workspace?.languageCode

    return (
        <div id="startnote">
            <div className='grid grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/richtext?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
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
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/canvas?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='w-8 h-8 flex items-center justify-center bg-[#E9F4E5] rounded-full mb-3'>
                                <IonIcon icon={shapesOutline} className='text-xl text-[#32A315]' />
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
                    {/* <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/voice?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
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
                    </IonCard> */}

                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/files?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='w-8 h-8 flex items-center justify-center bg-[#EEE4FA] rounded-full mb-3'>
                                <IonIcon icon={documentAttachOutline} className='text-xl text-[#5B00C9]' />
                            </div>

                            <div className='block mt-0 mb-0'>
                                <IonText className="font-semibold text-sm text-neutral-700">Files</IonText>
                            </div>

                            <div className='block leading-3 line-clamp-1'>
                                <IonText className='text-xs line-clamp-1'>
                                    Upload any media
                                </IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>

            {/* <IonCard className='w-full rounded-xl mt-4' routerLink={`/dashboard/editor/upload-image?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`} routerDirection='forward'>
                <IonCardContent>
                    <div className='flex gap-3 items-center'>
                        <div className='w-8 h-8 flex items-center justify-center bg-[#FFF0D9] rounded-full'>
                            <IonIcon icon={imageOutline} className='text-xl text-[#C95F00]' />
                        </div>

                        <div className='block flex-1'>
                            <div className='block mt-0 mb-0'>
                                <IonText className="font-semibold text-sm text-neutral-700">Upload Image</IonText>
                            </div>

                            <div className='block leading-3 line-clamp-1'>
                                <IonText className='text-xs line-clamp-1'>
                                    Take photo of your note book
                                </IonText>
                            </div>
                        </div>

                        <div className='ml-auto'>
                            <IonIcon icon={cloudUploadOutline} className='text-2xl' />
                        </div>
                    </div>
                </IonCardContent>
            </IonCard> */}
        </div>
    );
};

export default StartNote;
