import { IonActionSheet, IonAlert, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonViewDidEnter } from '@ionic/react';
import './Page.css';
import { addSharp, bookOutline, chevronForwardOutline, closeOutline, filterOutline, languageOutline, pencilOutline, peopleOutline, personCircleOutline, settingsOutline, trashOutline } from 'ionicons/icons';
import StartNote from '../../../../components/startnote/StartNote';
import WorkspaceStats from '../../../../components/workspace-stats/WorkspaceStats';
import NoteList from '../../../../components/note-list/NoteList';
import { useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useDeleteWorkspaceMutation, useGetWorkspaceByIdQuery, useLazyGetWorkspaceStatsQuery } from '../../../../services/workspace';
import { by639_1 } from 'iso-language-codes';
import MaterialList from '../../../../components/material-list/MaterialList';
import DigestList from '../../../../components/digest-list/DigestList';
import { intervalToDuration } from 'date-fns';
import LearnList from '../../../../components/learn-list/LearnList';

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

    const duration = intervalToDuration({
        start: 0,
        end: (workspace.total_duration_seconds ?? 0) * 1000 // intervalToDuration expects milliseconds
    });

    // Kalikan hari dengan 24 dan tambahkan ke sisa jam
    const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
    const minutes = duration.minutes ?? 0;

    const todayDuration = intervalToDuration({
        start: 0,
        end: (workspace.today_duration_seconds ?? 0) * 1000 // intervalToDuration expects milliseconds
    });

    // Kalikan hari dengan 24 dan tambahkan ke sisa jam
    const todayTotalHours = (todayDuration.days ?? 0) * 24 + (todayDuration.hours ?? 0);
    const todayMinutes = todayDuration.minutes ?? 0;

    return (
        <IonPage>
            <IonHeader color={'light'} className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center flex items-center justify-center fixed left-14 right-14 top-0 bottom-0 text-lg line-clamp-1">
                        Class Detail

                        <div className='flex gap-1 items-center justify-center text-xs font-normal text-neutral-600'>
                            <div className='flex gap-1 items-center'>
                                <IonIcon icon={languageOutline} />
                                <IonText>{language.name}</IonText>
                            </div>

                            <IonText className='text-sm text-neutral-300'>&bull;</IonText>
                            <IonText className='text-neutral-600'>{workspace.scope === 'group' ? `${workspace.member_count} mates` : `Personal`}</IonText>
                        </div>
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
                    <div className="bg-gradient-to-b from-[#f4f5f8] to-white rounded-b-3xl relative z-10 pb-6 md:pb-12 shadow-md shadow-neutral-200/50">
                        <div className='ion-padding'>
                            <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                                <div className='block ion-text-center'>
                                    <h1 className='block mb-1 !mt-0 !leading-3 text-center'>
                                        <IonText className='text-xl ion-text-center'>{workspace.title || 'Class Detail'}</IonText>
                                    </h1>

                                    <div className='flex justify-center gap-10 lg:gap-16 mt-6'>
                                        <div className='block w-auto'>
                                            <div className='flex flex-col'>
                                                <IonText className='text-[10px] mb-0 pb-0 albert-font text-neutral-400 !font-normal uppercase tracking-widest'>Studied</IonText>

                                                <div className='flex flex-col'>
                                                    <div className='flex justify-center items-end flex-row'>
                                                        <IonText className='oswald-font text-2xl font-normal'>{totalHours}</IonText>
                                                        <IonText className='oswald-font text-lg font-bold'>.{minutes}</IonText>
                                                    </div>

                                                    {workspace?.today_duration_seconds === 0 && (
                                                        <IonText className='oswald-font text-sm text-neutral-500 !font-normal -mt-0.5'>hours</IonText>
                                                    )}

                                                    {!!workspace?.today_duration_seconds && workspace.today_duration_seconds > 0 && (
                                                        <IonText className='oswald-font text-sm text-green-500 !font-normal -mt-0.5'>+ {todayTotalHours} hours</IonText>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className='block w-auto'>
                                            <div className='flex flex-col'>
                                                <IonText className='text-[10px] mb-0 pb-0 albert-font text-neutral-400 !font-normal uppercase tracking-widest'>Sessions</IonText>

                                                <div className='flex flex-col'>
                                                    <div className='flex justify-center items-end flex-row'>
                                                        <IonText className='oswald-font text-2xl font-normal'>{workspace.total_session_count}</IonText>
                                                    </div>

                                                    {workspace?.today_session_count === 0 && (
                                                        <IonText className='oswald-font text-sm text-neutral-500 !font-normal -mt-0.5'>in total</IonText>
                                                    )}

                                                    {!!workspace?.today_session_count && workspace.today_session_count > 0 && (
                                                        <IonText className='oswald-font text-sm text-green-500 !font-normal -mt-0.5'>+ {workspace.today_session_count} today</IonText>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className='block w-auto'>
                                            <div className='flex flex-col'>
                                                <IonText className='text-[10px] mb-0 pb-0 albert-font text-neutral-400 !font-normal uppercase tracking-widest'>Notes</IonText>

                                                <div className='flex flex-col'>
                                                    <div className='flex justify-center items-end flex-row'>
                                                        <IonText className='oswald-font text-2xl font-normal'>{workspace.total_note_count}</IonText>
                                                    </div>

                                                    {workspace?.today_note_count === 0 && (
                                                        <IonText className='oswald-font text-sm text-neutral-500 !font-normal -mt-0.5'>in total</IonText>
                                                    )}

                                                    {!!workspace?.today_note_count && workspace.today_note_count > 0 && (
                                                        <IonText className='oswald-font text-sm text-green-500 !font-normal -mt-0.5'>+ {workspace.today_note_count} today</IonText>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='-mt-6 relative z-20 flex gap-3 justify-center'>
                        <IonButton mode="md" shape="round" color="warning" style={{ 'minHeight': '44px' }}>
                            <IonIcon icon={bookOutline} slot="start" className='mr-2' />
                            <IonText className="normal-case tracking-normal">Live Session</IonText>
                        </IonButton>

                        <IonButton
                            mode="md"
                            shape="round"
                            color="dark"
                            style={{ 'minHeight': '44px', 'minWidth': '44px' }}
                            routerLink={`/dashboard/editor/session?workspaceId=${id}`}
                        >
                            <IonIcon icon={addSharp} slot="icon-only" />
                        </IonButton>
                    </div>

                    <div className='pt-6'>
                        <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                            <LearnList workspaceId={id} />
                        </div>
                    </div>

                    {/* <div className='ion-padding !pt-0'>
                        <div className='block mb-3 text-base text-neutral-600'>
                            <IonText className='albert-font'>Start new notes</IonText>
                        </div>
                        <StartNote workspace={{ id: id, languageCode: workspace.language_code || 'en' }} />
                    </div>

                    <div className='ion-padding !pt-2'>
                        <div className='block mb-3 text-base text-neutral-600'>
                            <IonText className='albert-font'>Today's in Class</IonText>
                        </div>
                        <WorkspaceStats
                            isTab={true}
                            activeTab={activeTab}
                            onSetActiveTab={selectedTabHandler}
                            note={{ todayCount: workspaceStats?.total_notes_today ?? 0, total: workspaceStats?.total_notes ?? 0 }}
                            material={{ todayCount: workspaceStats?.total_materials_today ?? 0, total: workspaceStats?.total_materials ?? 0 }}
                            digest={{ todayCount: workspaceStats?.total_digests_today ?? 0, total: workspaceStats?.total_digests ?? 0 }}
                        />
                    </div> */}

                    {/* {id && (
                        <div className='block pt-3'>
                            <div className='text-lg ion-padding-start ion-padding-end flex items-center justify-center'>
                                <IonText className='albert-font text-base text-neutral-600'><u>{activeTabLabel}</u> in Class</IonText>
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
                    )} */}
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