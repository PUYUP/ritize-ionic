import { IonActionSheet, IonAlert, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { chevronForwardOutline, closeOutline, pencilOutline, personCircleOutline, settingsOutline, trashOutline } from 'ionicons/icons';
import StartNote from '../../../../components/startnote/StartNote';
import WorkspaceStats from '../../../../components/workspace-stats/WorkspaceStats';
import NoteList from '../../../../components/note-list/NoteList';
import { useParams } from 'react-router';
import { useState } from 'react';
import { useDeleteWorkspaceMutation, useGetWorkspaceByIdQuery } from '../../../../services/workspace';

interface RouteParams {
    id?: string
    name?: string
    [key: string]: string | undefined
}

const WorkspaceDetailPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [deleteWorkspace, { isLoading: deleting }] = useDeleteWorkspaceMutation();
    const { data: workspace, error, isLoading } = useGetWorkspaceByIdQuery(id ?? "", { skip: !id });

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

            <IonContent role="feed">
                <div style={{ 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className='ion-padding'>
                        <div className='flex items-start mb-4'>
                            <div className='block ion-padding-end'>
                                <div className='block'>
                                    <IonText className='text-lg font-semibold leading-4'>{workspace.title || 'Workspace Detail'}</IonText>
                                </div>

                                <div className='text-base text-neutral-700'>
                                    <IonText>Add new notes...</IonText>
                                </div>
                            </div>

                            {workspace.scope === 'group' && (
                                <div className='ml-auto flex items-start'>
                                    <div
                                        onClick={() => ionRouter.push(`/dashboard/workspace/${id}/members`, "forward")}
                                        className='flex flex-col items-start justify-start bg-[#F1F1F1] rounded-xl p-2 pr-1 pt-1 shadow-sm min-w-20'
                                    >
                                        <div className='flex items-center justify-between w-full'>
                                            <div className='flex items-center gap-1'>
                                                <IonIcon icon={personCircleOutline} className='text-xl text-[#424242] mt-[1px]' />
                                                <IonText className='text-lg text-[#383838] font-semibold'>{workspace.member_count || 0}</IonText>
                                            </div>
                                            <IonIcon icon={chevronForwardOutline} className='text-xl text-[#424242] mt-[1px]' />
                                        </div>

                                        <IonText className='text-xs text-[#383838] leading-3'>members</IonText>
                                    </div>
                                </div>
                            )}
                        </div>

                        <StartNote workspace={{ id: id, languageCode: workspace.language_code || 'en' }} />
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

                    {id && (
                        <div className='block'>
                            <div className='block mb-0 text-lg ion-padding !pb-0'>
                                <IonText>Notes in workspace</IonText>
                            </div>
                            <NoteList workspaceId={id} />
                        </div>
                    )}
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
                        handler: () => {
                            setShowDeleteAlert(true);
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

            {/* delete workspace */}
            <IonAlert
                isOpen={showDeleteAlert}
                onDidDismiss={() => setShowDeleteAlert(false)}
                header='Are you sure to remove this workspace?'
                message={'All DATA on this workspace will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            if (!id) return;
                            await deleteWorkspace({ id });

                            if (ionRouter.canGoBack()) {
                                ionRouter.goBack();
                            } else {
                                ionRouter.push("/dashboard", "back", "pop");
                            }
                        },
                    },
                ]}
            ></IonAlert>
        </IonPage>
    );
};

export default WorkspaceDetailPage;