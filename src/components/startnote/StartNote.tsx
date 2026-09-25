import { analyticsOutline, chevronForwardOutline, cloudUploadOutline, documentAttachOutline, fileTrayOutline, imageOutline, imagesOutline, micOutline, shapesOutline, textOutline } from 'ionicons/icons';
import './StartNote.css';
import { IonCard, IonCardContent, IonIcon, IonText } from '@ionic/react';

interface StartNoteProps {
    workspace?: {
        id?: string;
        languageCode?: string;
        sessionId?: string;
    },
    notesCount?: {
        text?: number;
        canvas?: number;
        file?: number;
    }
}

const StartNote: React.FC<StartNoteProps> = ({ workspace, notesCount }) => {
    const workspaceId = workspace?.id;
    const languageCode = workspace?.languageCode;
    const sessionId = workspace?.sessionId;

    return (
        <div id="startnote">
            <div className='grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/richtext?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}${sessionId ? `&sessionId=${sessionId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center gap-1.5'>
                                <div className='w-6 h-6 flex items-center justify-center bg-[#E1F2F1] rounded-full'>
                                    <IonIcon icon={textOutline} className='text-base text-[#008C88]' />
                                </div>

                                <div className='block mt-0 mb-0'>
                                    <IonText className="font-semibold text-sm text-neutral-700 albert-font">Texting</IonText>
                                </div>
                            </div>

                            <div className='flex items-center justify-between leading-3 mt-2'>
                                <IonText className='text-xs line-clamp-1'>
                                    {notesCount?.text !== undefined && notesCount?.text > 0 ? `${notesCount?.text} notes` : "Keyboard device"}
                                </IonText>

                                <IonIcon icon={chevronForwardOutline} className='text-sm'></IonIcon>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/canvas?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}${sessionId ? `&sessionId=${sessionId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center gap-1.5'>
                                <div className='w-6 h-6 flex items-center justify-center bg-[#E9F4E5] rounded-full'>
                                    <IonIcon icon={shapesOutline} className='text-base text-[#32A315]' />
                                </div>

                                <div className='block mt-0 mb-0'>
                                    <IonText className="font-semibold text-sm text-neutral-700 albert-font">Canvas</IonText>
                                </div>
                            </div>

                            <div className='flex items-center justify-between leading-3 mt-2'>
                                <IonText className='text-xs line-clamp-1'>
                                    {notesCount?.canvas !== undefined && notesCount?.canvas > 0 ? `${notesCount?.canvas} notes` : "Use stylus or finger"}
                                </IonText>

                                <IonIcon icon={chevronForwardOutline} className='text-sm'></IonIcon>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    {/* <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/voice?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}${sessionId ? `&sessionId=${sessionId}` : ''}`} routerDirection='forward'>
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

                    <IonCard className='w-full rounded-xl' routerLink={`/dashboard/editor/files?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}${sessionId ? `&sessionId=${sessionId}` : ''}`} routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center gap-1.5'>
                                <div className='w-6 h-6 flex items-center justify-center bg-[#EEE4FA] rounded-full'>
                                    <IonIcon icon={imagesOutline} className='text-base text-[#5B00C9]' />
                                </div>

                                <div className='block mt-0 mb-0'>
                                    <IonText className="font-semibold text-sm text-neutral-700 albert-font">Upload</IonText>
                                </div>
                            </div>

                            <div className='flex items-center justify-between leading-3 mt-2'>
                                <IonText className='text-xs line-clamp-1'>
                                    {notesCount?.file !== undefined && notesCount?.file > 0 ? `${notesCount?.file} notes` : "Note in the book"}
                                </IonText>

                                <IonIcon icon={chevronForwardOutline} className='text-sm'></IonIcon>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>

            {/* <IonCard className='w-full rounded-xl mt-4' routerLink={`/dashboard/editor/upload-image?languageCode=${languageCode}${workspaceId ? `&workspaceId=${workspaceId}` : ''}${sessionId ? `&sessionId=${sessionId}` : ''}`} routerDirection='forward'>
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