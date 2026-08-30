import { bulbOutline, folderOpenOutline, readerOutline } from 'ionicons/icons';
import './WorkspaceStats.css';
import { IonCard, IonCardContent, IonIcon, IonText } from '@ionic/react';
import { NumericFormat } from 'react-number-format';

interface WorkspaceStatsProps {
    note: {
        todayCount: number;
        total: number;
    };
    material: {
        todayCount: number;
        total: number;
    };
    digest: {
        todayCount: number;
        total: number;
    };
}

const WorkspaceStats: React.FC<WorkspaceStatsProps> = ({ note, material, digest }) => {
    return (
        <div id="today-workspace">
            <div className='grid grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-2xl font-semibold leading-3 text-neutral-700'>{note.todayCount}</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={readerOutline} className='text-2xl text-[#008F83]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold text-neutral-700'>Notes</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <NumericFormat
                                    value={note.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-2xl font-semibold leading-3 text-neutral-700'>{material.todayCount}</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={folderOpenOutline} className='text-2xl text-[#1683E8]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold text-neutral-700'>Materials</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <NumericFormat
                                    value={material.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard className='w-full rounded-xl' routerLink='/editor/richtext' routerDirection='forward'>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-2xl font-semibold leading-3 text-neutral-700'>{digest.todayCount}</div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={bulbOutline} className='text-2xl text-[#E5A000]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold text-neutral-700'>Digest</IonText>
                            </div>

                            <div className='text-xs mt-0.5'>
                                <NumericFormat
                                    value={digest.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceStats;
