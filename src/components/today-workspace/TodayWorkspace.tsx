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
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>37k</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={readerOutline} className='text-lg' />
                                </div>
                            </div>

                            <div className='text-xs mt-4'>
                                <IonText className='font-semibold'>Notes</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'success'}>10 today</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>634</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={folderOpenOutline} className='text-lg' />
                                </div>
                            </div>

                            <div className='text-xs mt-4'>
                                <IonText className='font-semibold'>Materials</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'success'}>2 today</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-xl font-semibold leading-3 text-neutral-700'>24</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={bulbOutline} className='text-lg' />
                                </div>
                            </div>

                            <div className='text-xs mt-4'>
                                <IonText className='font-semibold'>Digest</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <IonText color={'success'}>6 today</IonText>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default TodayWorkspace;
