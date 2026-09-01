import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonViewDidEnter } from '@ionic/react';
import { useParams } from 'react-router';
import './Home.css';
import StartNote from '../../../components/startnote/StartNote';
import WorkspaceList from '../../../components/workspace-list/WorkspaceList';
import { add, addCircleOutline, arrowForwardOutline, chevronForwardCircleOutline, chevronForwardOutline } from 'ionicons/icons';
import { getGreeting } from '../../../utils/dayGreeting';
import WorkspaceStats from '../../../components/workspace-stats/WorkspaceStats';
import { useEffect, useState } from 'react';
import { getUser } from '../../../utils/authState';
import { supabase } from '../../../utils/supabaseClient';
import { useGetAllOrganizationsQuery } from '../../../services/organization';

const HomePage: React.FC = () => {
    const { name = '' } = useParams<{ name: string; }>();
    const { data: workspaces, isLoading } = useGetAllOrganizationsQuery();

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
                    <div className='block mb-1 leading-3 text-lg'>
                        <IonText>{getGreeting({ locale: 'en' })}, <strong>Rahman</strong></IonText>
                    </div>
                    {/* <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Start your notes...</IonText>
                    </div>
                    <StartNote /> */}

                    <div className='text-base mb-4 text-neutral-800'>
                        <IonText>Happening Today's</IonText>
                    </div>
                    <WorkspaceStats
                        note={{ todayCount: 2, total: 34000 }}
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
                                    <IonButton fill='clear' mode='ios'>
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
