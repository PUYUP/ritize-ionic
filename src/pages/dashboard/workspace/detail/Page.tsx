import { IonActionSheet, IonAlert, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { chevronForwardOutline, closeOutline, filterOutline, languageOutline, pencilOutline, peopleOutline, personCircleOutline, settingsOutline, trashOutline } from 'ionicons/icons';
import StartNote from '../../../../components/startnote/StartNote';
import WorkspaceStats from '../../../../components/workspace-stats/WorkspaceStats';
import NoteList from '../../../../components/note-list/NoteList';
import { useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useDeleteWorkspaceMutation, useGetWorkspaceByIdQuery, useLazyGetWorkspaceStatsQuery } from '../../../../services/workspace';
import { by639_1 } from 'iso-language-codes';
import MaterialList from '../../../../components/material-list/MaterialList';
import DigestList from '../../../../components/digest-list/DigestList';

interface RouteParams {
    id?: string
    name?: string
    [key: string]: string | undefined
}

const WorkspaceDetailPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const [activeTab, setActiveTab] = useState<string>('note');
    const [activeTabLabel, setActiveTabLabel] = useState<string>('Notes');
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [deleteWorkspace, { isLoading: deleting }] = useDeleteWorkspaceMutation();
    const { data: workspace, error, isLoading, isFetching } = useGetWorkspaceByIdQuery(id ?? "", { skip: !id });
    const [getWorkspaceStats, { data: workspaceStats, isFetching: workspaceStatsFetching }] = useLazyGetWorkspaceStatsQuery({});
    const [language, setLanguage] = useState<{ code: string; name: string }>({
        code: workspace?.language_code || 'en',
        name: by639_1[(workspace?.language_code || 'en') as keyof typeof by639_1].name
    });

    useEffect(() => {
        if (id) {
            getWorkspaceStats({ workspaceId: id });
        }
    }, [id, getWorkspaceStats]);

    useEffect(() => {
        if (workspace) {
            setLanguage({
                code: workspace.language_code || 'en',
                name: by639_1[(workspace.language_code || 'en') as keyof typeof by639_1].name
            });
        }
    }, [workspace, setLanguage]);

    const selectedTabHandler = (tab: string) => {
        if (tab === 'note') {
            setActiveTabLabel('Notes');
        } else if (tab === 'material') {
            setActiveTabLabel('Materials');
        } else if (tab === 'digest') {
            setActiveTabLabel('Digest');
        }
        setActiveTab(tab);
    }

    if (isLoading || !workspace || isFetching) {
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

    const ACTIONS = [
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
    ];

    if (workspace.scope === 'group') {
        ACTIONS.unshift({
            text: 'Manage Classmates',
            icon: peopleOutline,
            data: {
                action: 'manage-members',
            },
            handler: () => {
                ionRouter.push(`/dashboard/workspace/${id}/members`, "forward");
            }
        });
    }

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center flex items-center justify-center fixed left-14 right-14 top-0 bottom-0 text-lg line-clamp-1">
                        Class
                    </IonTitle>
                    <IonButtons slot="end" className='ion-padding-end'>
                        <IonButton className='!w-auto !h-auto' id="workspace-actions">
                            <IonIcon icon={settingsOutline} slot='icon-only' className='!text-lg' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent color="light" role="feed">
                <div style={{ 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className='ion-padding'>
                        <div className='flex items-start'>
                            <div className='block ion-padding-end'>
                                <div className='block mb-1'>
                                    <IonText className='text-lg font-semibold leading-4'>{workspace.title || 'Class Detail'}</IonText>
                                </div>

                                <div className='flex items-center gap-2 text-neutral-700'>
                                    <div className='flex gap-2 text-sm items-center'>
                                        <IonIcon icon={languageOutline} />
                                        <IonText>{language.name}</IonText>
                                    </div>

                                    <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                                    <IonText className='text-sm'>{workspace.scope === 'group' ? 'Group' : 'Personal'}</IonText>

                                    {workspace.scope === 'group' && (
                                        <>
                                            <IonText className='text-sm text-neutral-400'>&bull;</IonText>
                                            <div className='cursor-pointer text-blue-700 flex items-center gap-1 text-sm' onClick={() => ionRouter.push(`/dashboard/workspace/${id}/members`, "forward")}>
                                                <IonText>{workspace.member_count || 0} classmates</IonText>
                                                <IonIcon icon={chevronForwardOutline} />
                                            </div>
                                        </>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='ion-padding !pt-0'>
                        <div className='block mb-3 text-lg'>
                            <IonText>Start new notes</IonText>
                        </div>
                        <StartNote workspace={{ id: id, languageCode: workspace.language_code || 'en' }} />
                    </div>

                    <div className='ion-padding'>
                        <div className='block mb-3 text-lg'>
                            <IonText>Today's in Class</IonText>
                        </div>
                        <WorkspaceStats
                            isTab={true}
                            activeTab={activeTab}
                            onSetActiveTab={selectedTabHandler}
                            note={{ todayCount: workspaceStats?.total_notes_today ?? 0, total: workspaceStats?.total_notes ?? 0 }}
                            material={{ todayCount: workspaceStats?.total_materials_today ?? 0, total: workspaceStats?.total_materials ?? 0 }}
                            digest={{ todayCount: workspaceStats?.total_digests_today ?? 0, total: workspaceStats?.total_digests ?? 0 }}
                        />
                    </div>

                    {id && (
                        <div className='block'>
                            <div className='bg-neutral-200 block mb-0 text-lg ion-padding-start ion-padding-end !py-2 flex items-center justify-center'>
                                <IonText><u>{activeTabLabel}</u> in Class</IonText>
                                <div className='ml-auto flex items-center'>
                                    <IonButton shape='round' color="light" size="small">
                                        <IonIcon icon={filterOutline} slot='icon-only' />
                                    </IonButton>
                                </div>
                            </div>

                            {activeTab == 'note' && <NoteList workspaceId={id} />}
                            {activeTab == 'material' && <div className="ion-padding"><MaterialList workspaceId={id} insideWorkspaceDetail={true} /></div>}
                            {activeTab == 'digest' && <div className="ion-padding"><DigestList workspaceId={id} /></div>}
                        </div>
                    )}
                </div>
            </IonContent>

            <IonActionSheet
                trigger="workspace-actions"
                header="Class Actions"
                buttons={ACTIONS}
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