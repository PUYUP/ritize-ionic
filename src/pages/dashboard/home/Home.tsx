import { IonButton, IonButtons, IonContent, IonFab, IonFooter, IonHeader, IonIcon, IonMenuButton, IonMenuToggle, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import WorkspaceList from '../../../components/workspace-list/WorkspaceList';
import { add, arrowForwardOutline, bookmarkOutline, bookOutline, calendarOutline, chatboxEllipsesSharp, diamondSharp, menuOutline, personCircleOutline, personOutline } from 'ionicons/icons';
import { getGreeting } from '../../../utils/dayGreeting';
import WorkspaceStats from '../../../components/workspace-stats/WorkspaceStats';
import { useEffect, useState } from 'react';
import { getUser } from '../../../utils/authState';
import { useGetAllWorkspacesQuery, useLazyGetWorkspaceStatsQuery } from '../../../services/workspace';
import { getInitials } from '../../../utils/generator';
import LearnGraph from '../../../components/learn-graph/LearnGraph';
import LearnStats from '../../../components/learn-stats/LearnStats';
import { useGetSessionDurationSummaryQuery } from '../../../services/learning.session';
import { useCurrentWeekRange } from '../../../hooks/useCurrentWeekRange';
import StartNote from '../../../components/startnote/StartNote';

const HomePage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { data: workspaces, isLoading } = useGetAllWorkspacesQuery({ from: 0, to: 10 });
    const [getWorkspaceStats, { data: workspaceStats }] = useLazyGetWorkspaceStatsQuery({});

    const { timezone, start_date, end_date } = useCurrentWeekRange();
    const { data: sessionStats, isFetching: isSessionStatsFetching } = useGetSessionDurationSummaryQuery({
        start_date: start_date,
        end_date: end_date,
        timezone: timezone,
    });
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

                    <div slot='end' className='ion-padding-end flex gap-4 w-[65%]'>
                        <div className='flex flex-1 items-center gap-2 justify-end'>
                            <IonIcon icon={diamondSharp} className='text-xl text-purple-600 animate-bounce' />
                            <IonText className='oswald-font text-base font-semibold text-purple-500 text-shadow-md'>1.245.525</IonText>
                        </div>

                        <div className='flex items-center gap-2'>
                            <IonButton shape="round" mode="md" color="medium" className='normal-button'>
                                <IonIcon icon={personOutline} slot="icon-only" />
                            </IonButton>

                            <IonButton shape="round" mode="md" color="medium" className='normal-button'>
                                <IonIcon icon={calendarOutline} slot="icon-only" />
                            </IonButton>
                        </div>
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

                <div className="bg-gradient-to-b from-[#f4f5f8] to-white rounded-b-3xl relative z-10 pb-4 md:pb-10 shadow-md shadow-neutral-200/50">
                    <div className='ion-padding'>
                        <LearnStats durationSeconds={sessionStats?.total_durations ?? 0} />
                    </div>

                    <div className='block ion-padding-top !pt-14'>
                        <LearnGraph days={sessionStats?.days ?? []} />
                    </div>
                </div>

                {/* <div className='ion-padding'>
                    <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Start your notes...</IonText>
                    </div>
                    <StartNote />

                    <div className='text-base mb-4 text-neutral-600'>
                        <IonText className='albert-font'>Class Activities</IonText>
                    </div>
                    <WorkspaceStats
                        onSetActiveTab={gotoPage}
                        note={{ todayCount: workspaceStats?.total_notes_today ?? 0, total: workspaceStats?.total_notes ?? 0 }}
                        material={{ todayCount: workspaceStats?.total_materials_today ?? 0, total: workspaceStats?.total_materials ?? 0 }}
                        digest={{ todayCount: workspaceStats?.total_thinkings_today ?? 0, total: workspaceStats?.total_thinkings ?? 0 }}
                    />
                </div> */}

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

                <div className='block pt-4 md:pt-6 ion-padding-bottom ion-padding-start ion-padding-end'>
                    <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                        <div className='block mb-3 text-lg flex items-center justify-between'>
                            <div className='shadow-md bg-white px-2 py-1 rounded-2xl leading-3 flex items-center gap-1.5'>
                                <IonIcon icon={bookmarkOutline} />
                                <IonText className='text-sm albert-font text-neutral-600'>
                                    My Classes
                                </IonText>
                            </div>

                            <div className='ml-auto'>
                                <IonButton fill="solid" color={'warning'} shape='round' aria-label='Add workspace' routerLink={'/dashboard/editor/workspace'}>
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
                                        <IonButton fill='clear' color='dark' mode='ios' routerLink='/dashboard/workspace'>
                                            <IonText>View all</IonText>
                                            <IonIcon icon={arrowForwardOutline} size='small' className='ml-2' />
                                        </IonButton>
                                    </div>
                                </>
                            )
                        )}
                    </div>
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
                        <IonText>Chat w/ Note</IonText>
                    </IonButton>
                </div>
            </IonFooter>
        </IonPage>
    );
};

export default HomePage;