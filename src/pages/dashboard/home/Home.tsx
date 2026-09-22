import { IonButton, IonButtons, IonContent, IonFab, IonFooter, IonHeader, IonIcon, IonMenuButton, IonMenuToggle, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import WorkspaceList from '../../../components/workspace-list/WorkspaceList';
import { add, arrowForwardOutline, calendarOutline, chatboxEllipsesSharp, menuOutline, personCircleOutline, personOutline } from 'ionicons/icons';
import { getGreeting } from '../../../utils/dayGreeting';
import WorkspaceStats from '../../../components/workspace-stats/WorkspaceStats';
import { useEffect, useState } from 'react';
import { getUser } from '../../../utils/authState';
import { useGetAllWorkspacesQuery, useLazyGetWorkspaceStatsQuery } from '../../../services/workspace';
import { getInitials } from '../../../utils/generator';
import LearnGraph from '../../../components/learn-graph/LearnGraph';
import LearnStats from '../../../components/learn-stats/LearnStats';

const HomePage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { name = 'Ritize!' } = useParams<{ name: string; }>();
    const { data: workspaces, isLoading } = useGetAllWorkspacesQuery({ from: 0, to: 10 });
    const [getWorkspaceStats, { data: workspaceStats, isFetching: workspaceStatsFetching }] = useLazyGetWorkspaceStatsQuery({});
    const [user, setUser] = useState<any>(null);
    const [initialName, setInitialName] = useState<string>('AZ');

    useEffect(() => {
        async function fetchUser() {
            const currUser = await getUser();
            if (currUser) {
                setUser(currUser);
                getWorkspaceStats({ userId: currUser.id });
                setInitialName(getInitials(currUser.name));
            }
        }
        fetchUser();
    }, []);

    const gotoPage = (tab: string) => {
        switch (tab) {
            case 'note':
                ionRouter.push('/dashboard/notes');
                break;
            case 'material':
                ionRouter.push('/dashboard/materials');
                break;
            case 'digest':
                ionRouter.push('/dashboard/digests');
                break;
            default:
                break;
        }
    }

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonMenuToggle slot='start' className='ion-padding-start'>
                        <IonButton fill={'solid'} shape="round" mode="md" color="white" className='normal-button'>
                            <IonIcon icon={menuOutline} slot="icon-only" />
                        </IonButton>
                    </IonMenuToggle>

                    <div slot='end' className='ion-padding-end'>
                        <IonButton shape="round" mode="md" color="medium" className='normal-button mr-3'>
                            <IonIcon icon={personOutline} slot="icon-only" />
                        </IonButton>

                        <IonButton shape="round" mode="md" color="medium" className='normal-button'>
                            <IonIcon icon={calendarOutline} slot="icon-only" />
                        </IonButton>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'} fullscreen>
                {/* <div className='ion-padding'>
                    <div className='flex items-center gap-3 mb-6'>
                        <div className='w-14 h-14 flex items-center justify-center bg-amber-300 rounded-full shadow'>
                            <IonText className='text-neutral-900 text-xl font-bold'>{initialName}</IonText>
                        </div>
                        <div className='block mb-1 leading-3 text-lg'>
                            <IonText className='block text-xs text-neutral-500 uppercase tracking-widest mb-2'>{getGreeting({ locale: 'en' })}</IonText>
                            <h2>
                                <IonText className='font-bold'>{user?.name}</IonText>
                            </h2>
                        </div>
                    </div>
                </div> */}

                <div className='ion-padding'>
                    <LearnStats />
                </div>

                <div className='block ion-padding-top !pt-14'>
                    <LearnGraph />
                </div>

                <div className='ion-padding'>
                    {/* <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Start your notes...</IonText>
                    </div>
                    <StartNote /> */}

                    <div className='text-base mb-4 text-neutral-600'>
                        <IonText className='albert-font'>Class Activities</IonText>
                    </div>
                    <WorkspaceStats
                        onSetActiveTab={gotoPage}
                        note={{ todayCount: workspaceStats?.total_notes_today ?? 0, total: workspaceStats?.total_notes ?? 0 }}
                        material={{ todayCount: workspaceStats?.total_materials_today ?? 0, total: workspaceStats?.total_materials ?? 0 }}
                        digest={{ todayCount: workspaceStats?.total_thinkings_today ?? 0, total: workspaceStats?.total_thinkings ?? 0 }}
                    />
                </div>

                {/* <div className='ion-padding !pb-2'>
                    <div className='block mb-3 text-lg'>
                        <IonText>Happening Today's</IonText>
                    </div>
                    <WorkspaceStats
                        note={{ todayCount: 2, total: 34000 }}
                        material={{ todayCount: 1, total: 221 }}
                        digest={{ todayCount: 3, total: 62 }}
                    />
                </div> */}

                <div className='block pt-3 ion-padding-bottom'>
                    <div className='block mb-3 text-lg flex items-center justify-between ion-padding-start ion-padding-end'>
                        <IonText className='text-base albert-font text-neutral-600'>My Classes</IonText>
                        <div className='ml-auto'>
                            <IonButton fill="outline" size='small' mode="ios" shape='round' aria-label='Add workspace' routerLink={'/dashboard/editor/workspace'}>
                                <IonIcon icon={add} slot='icon-only' className='text-xl' />
                            </IonButton>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className='flex flex-col items-center justify-center gap-4'>
                            <IonSpinner name="crescent" />
                            <IonText>Loading data...</IonText>
                        </div>
                    ) : (
                        !workspaces || workspaces.length === 0 ? (
                            <div className='ion-padding-start ion-padding-end'>
                                <div className='flex flex-col items-center justify-center gap-4 bg-red-100 rounded-lg border border-red-200 ion-padding'>
                                    <IonText className='text-center text-base block'>
                                        No workspaces found.
                                        If you’re a university student, think workspace as a course.
                                    </IonText>
                                    <IonButton mode='ios' routerLink={'/dashboard/editor/workspace'} shape="round">Create Workspace</IonButton>
                                </div>
                            </div>
                        ) : (
                            <>
                                <WorkspaceList items={workspaces} />
                                <div className='mt-4 text-center'>
                                    <IonButton fill='clear' mode='ios' routerLink='/dashboard/workspace'>
                                        <IonText>View all</IonText>
                                        <IonIcon icon={arrowForwardOutline} size='small' className='ml-2' />
                                    </IonButton>
                                </div>
                            </>
                        )
                    )}

                </div>
            </IonContent>

            <IonFooter color='light' className='ion-no-border ion-padding'>
                <div className='flex justify-end'>
                    <IonButton
                        color={'dark'}
                        shape="round"
                        mode='ios'
                        className='flex items-center gap-2'
                        routerLink={'/dashboard/chatbot'}
                    >
                        <IonIcon slot="start" className='mr-2' icon={chatboxEllipsesSharp} />
                        <IonText>Ask Note</IonText>
                    </IonButton>
                </div>
            </IonFooter>
        </IonPage>
    );
};

export default HomePage;
