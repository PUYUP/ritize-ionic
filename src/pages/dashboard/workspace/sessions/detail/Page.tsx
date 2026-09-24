import React from 'react';
import './Page.css';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import { useGetLearningSessionByIdQuery } from '../../../../../services/learning.session';
import { bookmarkSharp, pricetagsSharp, settingsOutline, timeOutline } from 'ionicons/icons';
import { format } from 'date-fns';
import { intervalToDuration } from 'date-fns';
import StartNote from '../../../../../components/startnote/StartNote';
import NoteListSessioned from '../../../../../components/note-list-sessioned/NoteListSessioned';

interface RouteParams {
    id?: string
    sessionId?: string
    [key: string]: string | undefined
}

const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const SessionDetailPage: React.FC = () => {
    const { id: workspaceId, sessionId } = useParams<RouteParams>();
    const { data: sessionData, error, isLoading, isFetching } = useGetLearningSessionByIdQuery(sessionId ?? "", { skip: !sessionId });

    if (isLoading) {
        return (
            <IonPage>
                <IonContent color={'light'}>
                    <div className='h-full w-full flex flex-col gap-3 items-center justify-center'>
                        <IonSpinner></IonSpinner>
                        <IonText className='text-sm text-neutral-600'>Loading...</IonText>
                    </div>
                </IonContent>
            </IonPage>
        )
    }

    const duration = intervalToDuration({
        start: 0,
        end: (sessionData?.duration_seconds ?? 0) * 100 // intervalToDuration expects milliseconds
    });

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end ion-text-center'>
                        Study Session
                    </IonTitle>

                    <div slot="end" className="ion-padding-end">
                        <IonButton
                            shape="round"
                            mode="md"
                            color={'white'}
                            className='normal-button'
                        >
                            <IonIcon icon={settingsOutline} slot="icon-only" />
                        </IonButton>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'}>
                <div className="bg-gradient-to-b from-[#f4f5f8] to-white rounded-b-3xl relative z-10 pb-1 shadow-md shadow-neutral-200/50">
                    <div className='ion-padding flex gap-3'>
                        <div className='flex-1'>
                            <div className='flex items-center mb-6 gap-2'>
                                <IonIcon icon={timeOutline} className='text-4xl text-neutral-600' />
                                <div className='text-3xl font-bold text-neutral-900 !my-0 oswald-font flex gap-2'>
                                    <IonText>
                                        {duration.hours}
                                        <span className="font-normal text-2xl text-neutral-600">h</span>
                                    </IonText>

                                    <IonText>
                                        {duration.minutes}
                                        <span className="font-normal text-2xl text-neutral-600">m</span>
                                    </IonText>
                                </div>
                            </div>

                            <div className='block ion-margin-bottom'>
                                <div className='flex items-center gap-2 mb-1'>
                                    <div className='flex items-center'>
                                        <IonIcon icon={bookmarkSharp} className='text-neutral-400'></IonIcon>
                                    </div>
                                    <IonText className='!text-[11px] text-neutral-500 uppercase tracking-widest oswald-font'>In Class</IonText>
                                </div>

                                <h1 className='!font-semibold text-neutral-800 !my-0 !text-base !leading-6 line-clamp-2'>
                                    {sessionData?.workspace.title}
                                </h1>
                            </div>

                            <div className='block'>
                                <div className='flex items-center gap-2 mb-1'>
                                    <div className='flex items-center'>
                                        <IonIcon icon={pricetagsSharp} className='text-neutral-400'></IonIcon>
                                    </div>
                                    <IonText className='!text-[11px] text-neutral-500 uppercase tracking-widest oswald-font'>Topic</IonText>
                                </div>

                                <div className='text-base text-neutral-800 !my-0 albert-font !font-normal !leading-6'>
                                    <IonText>{sessionData?.title ? sessionData?.title : 'Not defined...'}</IonText>
                                </div>
                            </div>
                        </div>

                        <div className='w-24 pl-2 flex-none'>
                            <div className='h-full flex flex-col justify-between relative'>
                                <div className='absolute top-3 -left-[11px] bottom-8 border-l-2 border-dashed border-neutral-200'></div>
                                <div className='flex flex-col relative'>
                                    <div className='absolute w-3 h-3 top-2 -left-4'>
                                        <div className='w-3 h-3 bg-green-300 rounded-full animate-ping absolute top-0 left-0'></div>
                                        <div className='w-3 h-3 bg-green-300 rounded-full absolute top-0 left-0'></div>
                                    </div>

                                    <IonText className='text-lg oswald-font font-semibold text-neutral-800'>{format(sessionData?.started_at ?? '', 'HH:mm')}</IonText>
                                    <IonText className='text-sm albert-font text-neutral-500 !font-normal'>{format(sessionData?.started_at ?? '', 'dd MMM yyyy')}</IonText>
                                </div>

                                <div className='flex flex-col relative'>
                                    <div className='absolute w-3 h-3 top-2 -left-4'>
                                        <div className='w-3 h-3 bg-red-300 rounded-full animate-ping absolute top-0 left-0'></div>
                                        <div className='w-3 h-3 bg-red-300 rounded-full absolute top-0 left-0'></div>
                                    </div>
                                    <IonText className='text-lg oswald-font font-semibold text-neutral-800'>{format(sessionData?.ended_at ?? '', 'HH:mm')}</IonText>
                                    <IonText className='text-sm albert-font text-neutral-500 !font-normal'>{format(sessionData?.ended_at ?? '', 'dd MMM yyyy')}</IonText>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='ion-padding !pb-0'>
                    <div className='block mb-2'>
                        <IonText className='text-base albert-font text-neutral-800 !font-semibold'>Add session notes</IonText>
                    </div>
                    <StartNote
                        workspace={{
                            id: workspaceId,
                            languageCode: sessionData?.workspace?.language_code || 'en',
                            sessionId: sessionData?.id,
                        }}
                        notesCount={{
                            text: sessionData?.pages_text?.length ?? 0,
                            canvas: sessionData?.pages_canvas?.length ?? 0,
                            file: sessionData?.pages_file?.length ?? 0,
                        }}
                    />
                </div>

                <NoteListSessioned workspaceId={workspaceId} learningSessionId={sessionId} />
            </IonContent>
        </IonPage>
    )
}

export default SessionDetailPage;