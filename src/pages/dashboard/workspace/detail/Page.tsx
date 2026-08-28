import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Page.css';
import { useLocation, useParams } from 'react-router-dom'
import { briefcase, ellipsisVerticalOutline, personCircleOutline, personOutline } from 'ionicons/icons';
import StartNote from '../../../../components/startnote/StartNote';
import WorkspaceStats from '../../../../components/workspace-stats/WorkspaceStats';

interface RouteParams {
    id?: string
    name?: string
    [key: string]: string | undefined
}

const WorkspaceDetailPage: React.FC = () => {
    const { id } = useParams<RouteParams>()
    const query = new URLSearchParams(useLocation().search)
    const name = query.get('name');
    const scope: string = 'group';

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>
                    <IonTitle className="text-center flex items-center justify-center fixed left-14 right-14 top-0 bottom-0 text-lg line-clamp-1">
                        Workspace
                    </IonTitle>
                    <IonButtons slot="end" className='ion-padding-end'>
                        <IonButton className='!w-auto !h-auto'>
                            <IonIcon icon={ellipsisVerticalOutline} slot='icon-only' className='!text-lg' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <div className='ion-padding'>
                    <div className='flex items-start mb-4'>
                        <div className='block'>
                            <div className='block'>
                                <IonText className='text-lg font-semibold leading-4'>{name || 'Workspace Detail'}</IonText>
                            </div>

                            <div className='text-base text-neutral-700'>
                                <IonText>Add new notes...</IonText>
                            </div>
                        </div>

                        {scope === 'group' && (
                            <div className='ml-auto flex items-start'>
                                <div className='flex flex-col items-center justify-center bg-[#FFF1F1] rounded-xl p-2 pt-1 shadow-sm'>
                                    <div className='flex items-center justify-center gap-1'>
                                        <IonIcon icon={personCircleOutline} className='text-xl text-[#E53935] mt-[1px]' />
                                        <IonText className='text-lg text-[#D92D2D] font-semibold'>10</IonText>
                                    </div>

                                    <IonText className='text-xs text-[#D92D2D] leading-3'>members</IonText>
                                </div>
                            </div>
                        )}
                    </div>

                    <StartNote workspace={{ id: Number(id ?? 0) }} />
                </div>

                <div className='ion-padding'>
                    <div className='block mb-3 text-lg'>
                        <IonText>Today's in workspace</IonText>
                    </div>
                    <WorkspaceStats
                        note={{ todayCount: 2, total: 34000 }}
                        material={{ todayCount: 1, total: 221 }}
                        digest={{ todayCount: 3, total: 62 }}
                    />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default WorkspaceDetailPage;