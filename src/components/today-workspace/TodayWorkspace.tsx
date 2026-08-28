import { analyticsOutline, bulbOutline, createOutline, documentOutline, folderOpenOutline, imageOutline, listOutline, readerOutline, textOutline } from 'ionicons/icons';
import './TodayWorkspace.css';
import { IonCard, IonCardContent, IonCardTitle, IonIcon, IonText } from '@ionic/react';

interface TodayWorkspaceProps { }

const TodayWorkspace: React.FC<TodayWorkspaceProps> = () => {
    return (
        <div id="today-workspace">
            <div className='grid grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>2</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={readerOutline} className='text-xl text-[#008F83]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold'>Notes</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'medium'}>34k total</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>1</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={folderOpenOutline} className='text-xl text-[#1683E8]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold'>Materials</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'medium'}>221 total</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>3</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={bulbOutline} className='text-xl text-[#E5A000]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold'>Digest</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'medium'}>62 total</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default TodayWorkspace;
