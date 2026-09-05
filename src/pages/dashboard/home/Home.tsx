import { IonAvatar, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonImg, IonMenuButton, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonViewDidEnter } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import WorkspaceList from '../../../components/workspace-list/WorkspaceList';
import { add, arrowForwardOutline } from 'ionicons/icons';
import { getGreeting } from '../../../utils/dayGreeting';
import WorkspaceStats from '../../../components/workspace-stats/WorkspaceStats';
import { useEffect, useState } from 'react';
import { getUser } from '../../../utils/authState';
import { useGetAllWorkspacesQuery, useLazyGetWorkspaceStatsQuery } from '../../../services/workspace';
import { getInitials } from '../../../utils/generator';

const HomePage: React.FC = () => {
    const { name = '' } = useParams<{ name: string; }>();
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

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonMenuButton />
                    </IonButtons>
                    <IonTitle>{name}</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen>
                <div className='ion-padding'>
                    <div className='flex items-center gap-3 mb-6'>
                        <div className='w-14 h-14 flex items-center justify-center bg-amber-300 rounded-full shadow'>
                            <IonText className='text-neutral-900 text-xl font-bold'>{initialName}</IonText>
                        </div>
                        <div className='block mb-1 leading-3 text-lg'>
                            <IonText className='block text-xs text-neutral-500 uppercase tracking-widest mb-2'>{getGreeting({ locale: 'en' })}</IonText>
                            <IonText className='font-bold'>{user?.name}</IonText>
                        </div>
                    </div>

                    {/* <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Start your notes...</IonText>
                    </div>
                    <StartNote /> */}

                    <div className='text-lg mb-4 text-neutral-800'>
                        <IonText>Happening Today's</IonText>
                    </div>
                    <WorkspaceStats
                        note={{ todayCount: workspaceStats?.total_notes_today ?? 0, total: workspaceStats?.total_notes ?? 0 }}
                        material={{ todayCount: 1, total: 221 }}
                        digest={{ todayCount: 3, total: 62 }}
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

                <div className='ion-padding'>
                    <div className='block mb-3 text-lg flex items-center justify-between'>
                        <IonText>My Workspaces</IonText>
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
                            <div className='flex flex-col items-center justify-center gap-4 bg-red-100 rounded-lg border border-red-200 ion-padding'>
                                <IonText className='text-center text-xs'>No workspaces found. Create one to get started.</IonText>
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
        </IonPage>
    );
};

export default HomePage;
