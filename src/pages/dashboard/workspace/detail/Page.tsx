import { IonActionSheet, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { closeOutline, pencilOutline, personCircleOutline, settingsOutline, trashOutline } from 'ionicons/icons';
import StartNote from '../../../../components/startnote/StartNote';
import WorkspaceStats from '../../../../components/workspace-stats/WorkspaceStats';
import NoteList from '../../../../components/note-list/NoteList';
import { useParams } from 'react-router';
import { useGetOrganizationByIdQuery } from '../../../../services/organization';

interface RouteParams {
    id?: string
    name?: string
    [key: string]: string | undefined
}

const WorkspaceDetailPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const { data: workspace, error, isLoading } = useGetOrganizationByIdQuery(id ?? "", {
        skip: !id,
    });

    if (isLoading || !workspace) {
        return (
            <IonPage>
                <IonContent className='ion-padding'>
                    <div className='h-full w-full flex items-center justify-center'>
                        <IonSpinner />
                    </div>
                </IonContent>
            </IonPage>
        )
    }

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>
                    <IonTitle className="text-base text-center flex items-center justify-center fixed left-14 right-14 top-0 bottom-0 text-lg line-clamp-1">
                        Workspace
                    </IonTitle>
                    <IonButtons slot="end" className='ion-padding-end'>
                        <IonButton className='!w-auto !h-auto' id="workspace-actions">
                            <IonIcon icon={settingsOutline} slot='icon-only' className='!text-lg' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <div style={{ 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className='ion-padding'>
                        <div className='flex items-start mb-4'>
                            <div className='block'>
                                <div className='block'>
                                    <IonText className='text-lg font-semibold leading-4'>{workspace.name || 'Workspace Detail'}</IonText>
                                </div>

                                <div className='text-base text-neutral-700'>
                                    <IonText>Add new notes...</IonText>
                                </div>
                            </div>

                            {workspace.metadata.scope === 'group' && (
                                <div className='ml-auto flex items-start'>
                                    <div className='flex flex-col items-center justify-center bg-[#FFF1F1] rounded-xl p-2 pt-1 shadow-sm'>
                                        <div className='flex items-center justify-center gap-1'>
                                            <IonIcon icon={personCircleOutline} className='text-xl text-[#E53935] mt-[1px]' />
                                            <IonText className='text-lg text-[#D92D2D] font-semibold'>{workspace.members?.length || 0}</IonText>
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

                    <div className='ion-padding'>
                        <NoteList workspaceId={Number(id ?? 0)} />
                    </div>
                </div>
            </IonContent>

            <IonActionSheet
                trigger="workspace-actions"
                header="Workspace Actions"
                buttons={[
                    {
                        text: 'Edit',
                        icon: pencilOutline,
                        data: {
                            action: 'edit',
                        },
                        handler: () => {
                            console.log("Edit");
                            ionRouter.push(`/dashboard/editor/workspace/${id}`, "forward");
                        }
                    },
                    {
                        text: 'Delete',
                        icon: trashOutline,
                        role: 'destructive',
                        data: {
                            action: 'delete',
                        },
                    },
                    {
                        text: 'Cancel',
                        icon: closeOutline,
                        role: 'cancel',
                        data: {
                            action: 'cancel',
                        },
                    },
                ]}
            ></IonActionSheet>
        </IonPage>
    );
};

export default WorkspaceDetailPage;