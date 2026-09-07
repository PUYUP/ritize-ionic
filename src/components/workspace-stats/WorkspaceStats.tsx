import { bulbOutline, chevronForwardOutline, folderOpenOutline, readerOutline } from 'ionicons/icons';
import './WorkspaceStats.css';
import { IonCard, IonCardContent, IonIcon, IonText } from '@ionic/react';
import { NumericFormat } from 'react-number-format';

interface WorkspaceStatsProps {
    isTab?: boolean;
    activeTab?: string;
    onSetActiveTab?: (tab: string) => void;
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

const WorkspaceStats: React.FC<WorkspaceStatsProps> = ({ isTab, activeTab, onSetActiveTab, note, material, digest }) => {
    return (
        <div id="today-workspace">
            <div className='grid grid-cols-3 gap-4'>
                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard onClick={() => onSetActiveTab?.('note')} className={`relative w-full rounded-xl ${isTab && activeTab === 'note' ? 'bg-lime-50' : ''}`}>
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

                            <div className='text-xs mt-0.5 flex items-center justify-between'>
                                <NumericFormat
                                    value={note.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />

                                <IonIcon icon={chevronForwardOutline} className='text-xs'></IonIcon>
                            </div>
                        </IonCardContent>

                        {isTab && activeTab === 'note' && <div className="absolute rounded-xl border-1 border-lime-200 top-0 right-0 left-0 bottom-0"></div>}
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard onClick={() => onSetActiveTab?.('material')} className={`relative w-full rounded-xl ${isTab && activeTab === 'material' ? 'bg-blue-50' : ''}`}>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-2xl font-semibold leading-3 text-neutral-700 relative'>
                                    {material.todayCount > 0 && <div className="h-2 w-2 bg-green-500 rounded-full animate-ping absolute -top-1 -right-1"></div>}
                                    {material.todayCount}
                                </div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={folderOpenOutline} className='text-2xl text-[#1683E8]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold text-neutral-700'>Materials</IonText>
                            </div>

                            <div className='text-xs mt-0.5 flex items-center justify-between'>
                                <NumericFormat
                                    value={material.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />

                                <IonIcon icon={chevronForwardOutline} className='text-xs'></IonIcon>
                            </div>
                        </IonCardContent>

                        {isTab && activeTab === 'material' && <div className="absolute rounded-xl border-1 border-blue-200 top-0 right-0 left-0 bottom-0"></div>}
                    </IonCard>
                </div>

                <div className='flex flex-col items-center justify-center gap-4'>
                    <IonCard onClick={() => onSetActiveTab?.('digest')} className={`relative w-full rounded-xl ${isTab && activeTab === 'digest' ? 'bg-yellow-50' : ''}`}>
                        <IonCardContent>
                            <div className='flex items-center justify-between w-full'>
                                <div className='text-2xl font-semibold leading-3 text-neutral-700 relative'>
                                    {digest.todayCount > 0 && <div className="h-2 w-2 bg-green-500 rounded-full animate-ping absolute -top-1 -right-1"></div>}
                                    {digest.todayCount}
                                </div>
                                <div className='ml-auto flex items-center'>
                                    <IonIcon icon={bulbOutline} className='text-2xl text-[#E5A000]' />
                                </div>
                            </div>

                            <div className='text-sm mt-3'>
                                <IonText className='font-semibold text-neutral-700'>Digest</IonText>
                            </div>

                            <div className='text-xs mt-0.5 flex items-center justify-between'>
                                <NumericFormat
                                    value={digest.total}
                                    displayType="text"
                                    thousandSeparator={true}
                                    suffix=" total"
                                    renderText={(value) => <IonText color={'medium'}>{value}</IonText>}
                                />

                                <IonIcon icon={chevronForwardOutline} className='text-xs'></IonIcon>
                            </div>
                        </IonCardContent>

                        {isTab && activeTab === 'digest' && <div className="absolute rounded-xl border-1 border-yellow-200 top-0 right-0 left-0 bottom-0"></div>}
                    </IonCard>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceStats;