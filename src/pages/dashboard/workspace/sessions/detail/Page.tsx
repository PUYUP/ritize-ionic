import React, { useEffect, useRef, useState } from 'react';
import './Page.css';
import { IonActionSheet, IonAlert, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonDatetime, IonHeader, IonIcon, IonItem, IonLabel, IonModal, IonPage, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { useParams } from 'react-router';
import { LearningSessionTypes, useDeleteSessionByIdMutation, useGetLearningSessionByIdQuery, useUpdateSessionMutation } from '../../../../../services/learning.session';
import { bookmarkSharp, checkmarkDoneSharp, checkmarkOutline, closeOutline, pencilOutline, pricetagsSharp, settingsOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { format, toZonedTime } from 'date-fns-tz';
import { intervalToDuration } from 'date-fns';
import StartNote from '../../../../../components/startnote/StartNote';
import NoteListSessioned from '../../../../../components/note-list-sessioned/NoteListSessioned';
import { useController, useForm } from 'react-hook-form';
import { dateToPickerValue } from '../../../../../utils/generator';
import { getUser } from '../../../../../utils/authState';

interface RouteParams {
    id?: string
    sessionId?: string
    [key: string]: string | undefined
}

type SessionFormValues = {
    startedAt: string | undefined;
    endedAt: string | undefined;
}

const SessionDetailPage: React.FC = () => {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const ionRouter = useIonRouter();
    const { id: workspaceId, sessionId } = useParams<RouteParams>();
    const [deleteSessionById] = useDeleteSessionByIdMutation();
    const [updateSession, { isLoading: isUpdating }] = useUpdateSessionMutation();
    const { data: sessionData, isLoading } = useGetLearningSessionByIdQuery(sessionId ?? "", { skip: !sessionId });
    const [showOptions, setShowOptions] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showEndSessionAlert, setShowEndSessionAlert] = useState(false);
    const [presentToast] = useIonToast();

    const today = new Date().toISOString().substring(0, 10);
    const [selectedDateTemp, setSelectedDateTemp] = useState<string>();
    const selectDatetimeModal = useRef<HTMLIonModalElement>(null);
    const [showSelectDatetimeModal, setShowSelectDatetimeModal] = useState<{ isOpen: boolean; type: 'startedAt' | 'endedAt' }>({ isOpen: false, type: 'startedAt' });

    const duration = intervalToDuration({
        start: 0,
        end: (sessionData?.duration_seconds ?? 0) * 1000 // intervalToDuration expects milliseconds
    });

    // Kalikan hari dengan 24 dan tambahkan ke sisa jam
    const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
    const minutes = duration.minutes ?? 0;

    // React Hook Form
    const {
        control,
        handleSubmit,
        watch,
        reset,
        trigger,
        setValues,
        formState: { isValid, isSubmitting },
    } = useForm<SessionFormValues>({
        mode: 'onChange',
        defaultValues: {
            startedAt: undefined,
            endedAt: undefined,
        },
    });

    const startedAtValue = watch('startedAt');
    const endedAtValue = watch('endedAt');

    const { field: startedAtField, fieldState: startedAtFieldState } = useController({
        control,
        name: 'startedAt',
        rules: { required: 'Select when the session started' },
    });

    const { field: endedAtField, fieldState: endedAtFieldState } = useController({
        control,
        name: 'endedAt',
        rules: {
            required: 'Select when the session ended',
            validate: (value) => {
                if (!value) return true;
                if (startedAtValue && new Date(value).getTime() <= new Date(startedAtValue).getTime()) {
                    return 'End time must be after the start time';
                }
                return true;
            },
        },
    });

    const durationEnded = intervalToDuration({
        start: startedAtValue ? new Date(startedAtValue) : new Date(),
        end: endedAtValue ? new Date(endedAtValue) : new Date()
    });

    // Kalikan hari dengan 24 dan tambahkan ke sisa jam
    const totalHoursEnded = (durationEnded.days ?? 0) * 24 + (durationEnded.hours ?? 0);
    const minutesEnded = durationEnded.minutes ?? 0;

    // Effect handler
    useEffect(() => {
        if (sessionData) {
            setValues({
                startedAt: sessionData.started_at,
                endedAt: sessionData.status !== 'completed' ? new Date().toISOString() : sessionData.ended_at,
            }, {
                shouldValidate: true,
            });
        }
    }, [sessionData, reset]);

    // store temporary date
    const selectDateHandler = (e: any) => {
        const value = e.detail.value;
        if (value) {
            setSelectedDateTemp(value);
        }
    }

    // confirm selected date
    const confirmDateHandler = () => {
        if (!selectedDateTemp) return;

        if (showSelectDatetimeModal.type === 'startedAt') {
            startedAtField.onChange(selectedDateTemp);
            // if an end date was already picked, re-check it against the new start date
            if (endedAtField.value) {
                trigger('endedAt');
            }
        } else {
            endedAtField.onChange(selectedDateTemp);
        }
    }

    const onSubmit = async (data: SessionFormValues) => {
        const user = await getUser();
        if (!user || !data.startedAt || !data.endedAt) return;

        const durationSeconds = data.startedAt && data.endedAt
            ? Math.max(0, Math.round((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 1000))
            : 0;

        const payload: Partial<LearningSessionTypes> = {
            started_at: data.startedAt,
            ended_at: data.endedAt,
            status: 'completed',
            duration_seconds: durationSeconds,
        }

        let result: LearningSessionTypes | null = null;

        if (sessionId && sessionData) {
            const { data: res, error } = await updateSession({
                id: sessionData.id,
                workspace_id: sessionData.workspace_id,
                body: payload
            });

            if (error) {
                return;
            }

            result = res;
        }

        reset();
        setSelectedDateTemp(undefined);
        setShowSelectDatetimeModal({ isOpen: false, type: 'startedAt' });
        setShowEndSessionAlert(false);

        presentToast({
            message: 'Session updated successfully',
            duration: 2000,
            color: 'success',
        });
    };

    // save handler
    const saveHandler = () => {
        handleSubmit(onSubmit)();
    }

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
                            onClick={() => setShowOptions(true)}
                        >
                            <IonIcon icon={settingsOutline} slot="icon-only" />
                        </IonButton>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'}>
                <div className={`bg-gradient-to-b from-[#f4f5f8] to-white rounded-b-3xl relative z-10 ${sessionData?.status === 'ongoing' ? 'pb-4' : 'pb-1'} shadow-md shadow-neutral-200/50`}>
                    <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                        <div className='ion-padding flex gap-3'>
                            <div className='flex-1'>
                                <div className='flex items-center mb-6 gap-2'>
                                    <IonIcon icon={timeOutline} className='text-4xl text-neutral-600' />
                                    <div className='text-3xl font-bold text-neutral-900 !my-0 oswald-font flex gap-2'>
                                        <IonText>
                                            {totalHours}
                                            <span className="font-normal text-2xl text-neutral-600">h</span>
                                        </IonText>

                                        <IonText>
                                            {minutes}
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

                                        <IonText className='text-lg oswald-font font-semibold text-neutral-800'>
                                            {format(sessionData?.started_at ?? '', 'HH:mm', { timeZone: userTimeZone })}
                                        </IonText>
                                        <IonText className='text-sm albert-font text-neutral-500 !font-normal'>
                                            {format(sessionData?.started_at ?? '', 'dd MMM yyyy', { timeZone: userTimeZone })}
                                        </IonText>
                                    </div>

                                    <div className='flex flex-col relative'>
                                        <div className='absolute w-3 h-3 top-2 -left-4'>
                                            {sessionData?.status === 'completed' && (
                                                <>
                                                    <div className='w-3 h-3 bg-red-300 rounded-full animate-ping absolute top-0 left-0'></div>
                                                    <div className='w-3 h-3 bg-red-300 rounded-full absolute top-0 left-0'></div>
                                                </>
                                            )}

                                            {sessionData?.status === 'ongoing' && (
                                                <>
                                                    <div className='w-3 h-3 bg-yellow-300 rounded-full animate-ping absolute top-0 left-0'></div>
                                                    <div className='w-3 h-3 bg-yellow-300 rounded-full absolute top-0 left-0'></div>
                                                </>
                                            )}
                                        </div>

                                        {sessionData?.status === 'completed' && (
                                            <>
                                                <IonText className='text-lg oswald-font font-semibold text-neutral-800'>
                                                    {format(sessionData?.ended_at ?? '', 'HH:mm', { timeZone: userTimeZone })}
                                                </IonText>
                                                <IonText className='text-sm albert-font text-neutral-500 !font-normal'>
                                                    {format(sessionData?.ended_at ?? '', 'dd MMM yyyy', { timeZone: userTimeZone })}
                                                </IonText>
                                            </>
                                        )}

                                        {sessionData?.status === 'ongoing' && (
                                            <>
                                                <IonText className='text-lg oswald-font font-semibold text-neutral-800'>On going</IonText>
                                                <IonText className='text-sm albert-font text-neutral-500 !font-normal'>live session...</IonText>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {sessionData?.status !== 'completed' && (
                    <div className='-mt-6 relative z-20 flex gap-3 justify-center'>
                        <IonButton mode="md" shape="round" color="success" style={{ 'minHeight': '44px' }} onClick={() => {
                            setValues({ endedAt: new Date().toISOString() }, {
                                shouldValidate: true,
                            });
                            setShowEndSessionAlert(true);
                        }}>
                            <IonIcon icon={checkmarkDoneSharp} slot="start" className='mr-2' />
                            <IonText className="normal-case tracking-normal">Mark Finished</IonText>
                        </IonButton>
                    </div>
                )}

                <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
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
                </div>
            </IonContent>

            <IonActionSheet
                isOpen={showOptions}
                onDidDismiss={() => {
                    setShowOptions(false);
                }}
                header="Session Actions"
                buttons={[
                    {
                        text: 'Edit',
                        icon: pencilOutline,
                        data: {
                            action: 'edit',
                        },
                        handler: async () => {
                            ionRouter.push(`/dashboard/workspace/${workspaceId}/sessions/${sessionId}/editor`);
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

            {/* delete session */}
            <IonAlert
                isOpen={showDeleteAlert}
                onDidDismiss={() => setShowDeleteAlert(false)}
                header='Are you sure to remove this session?'
                message={'All related data on this session will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            if (!sessionData?.id || !sessionData?.workspace_id) {
                                await presentToast({
                                    message: "Invalid session data",
                                    duration: 2000,
                                    color: 'danger',
                                    position: "top"
                                });
                                return;
                            }

                            await deleteSessionById({ id: sessionData.id, workspace_id: sessionData.workspace_id });
                            ionRouter.push(`/dashboard/workspace/${workspaceId}`, 'forward', 'replace');
                        },
                    },
                ]}
            ></IonAlert>

            {/* confirm start and end date */}
            <IonModal
                className='confirm-datetime-modal'
                isOpen={showEndSessionAlert}
                onDidDismiss={() => {
                    setShowEndSessionAlert(false);
                }}
            >
                <IonHeader className='ion-no-border'>
                    <IonToolbar color={'light'} className='borderless'>
                        <div slot="start" className='ion-padding-start'>
                            <IonButton shape='round' color='light' onClick={() => setShowEndSessionAlert(false)}>
                                <IonIcon icon={closeOutline} slot='icon-only' color='dark' />
                            </IonButton>
                        </div>
                        <IonTitle className='ion-text-center text-base absolute left-14 right-14 top-0 bottom-0'>End Session Confirmation</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <div className='bg-[#f4f5f8] ion-padding'>
                    <div className='flex'>
                        <div className='w-full'>
                            <div className='mb-0 pl-2'>
                                <IonText className='text-xs uppercase text-neutral-500 tracking-widest'>Started At</IonText>
                            </div>

                            <IonItem
                                lines="none"
                                mode='ios'
                                detail={true}
                                button={true}
                                className='select-workspace select-date p-2.5 pt-1 -mx-2.5'
                                onClick={() => {
                                    if (startedAtField.value) {
                                        const zonedDatetime = toZonedTime(new Date(startedAtField.value), userTimeZone);
                                        setSelectedDateTemp(dateToPickerValue(zonedDatetime));
                                    }

                                    setShowSelectDatetimeModal({ isOpen: true, type: 'startedAt' });
                                }}
                                style={{ '--min-height': '48px' }}
                            >
                                {startedAtField.value ? (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0 line-clamp-1'>{format(new Date(startedAtField.value), 'MMM dd, yyyy')}</p>
                                        <IonText className='text-xl oswald-font line-clamp-1 font-bold text-neutral-700'>{format(new Date(startedAtField.value), 'HH:mm')}</IonText>
                                    </IonLabel>
                                ) : (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0 line-clamp-1'>Select date</p>
                                        <IonText className='text-sm albert-font line-clamp-1 !font-normal'>Not selected</IonText>
                                    </IonLabel>
                                )}
                            </IonItem>
                            {startedAtFieldState.isTouched && startedAtFieldState.error && (
                                <IonText color='danger' className='text-xs block pl-2 mt-1'>
                                    {startedAtFieldState.error.message}
                                </IonText>
                            )}
                        </div>
                        <div className='border-neutral-200 px-2 flex items-center justify-center'>
                            <div className='h-full w-[0px] bg-neutral-200'></div>
                        </div>
                        <div className='w-full'>
                            <div className='mb-0 pl-2'>
                                <IonText className='text-xs uppercase text-neutral-500 tracking-widest'>Ended At</IonText>
                            </div>

                            <IonItem
                                lines="none"
                                mode='ios'
                                detail={true}
                                button={true}
                                className='select-workspace select-date p-2.5 pt-1 -mx-2.5'
                                onClick={() => {
                                    if (endedAtField.value) {
                                        const zonedDatetime = toZonedTime(new Date(endedAtField.value), userTimeZone);
                                        setSelectedDateTemp(dateToPickerValue(zonedDatetime));
                                    }

                                    setShowSelectDatetimeModal({ isOpen: true, type: 'endedAt' });
                                }}
                                disabled={!startedAtField.value}
                                style={{ '--min-height': '48px' }}
                            >
                                {endedAtField.value ? (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0 line-clamp-1'>{format(new Date(endedAtField.value), 'MMM dd, yyyy')}</p>
                                        <IonText className='text-xl oswald-font line-clamp-1 font-bold text-neutral-700'>{format(new Date(endedAtField.value), 'HH:mm')}</IonText>
                                    </IonLabel>
                                ) : (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0 line-clamp-1'>Select date</p>
                                        <IonText className='text-base albert-font !font-normal line-clamp-1'>
                                            {startedAtField.value ? 'Not selected' : 'Started at first'}
                                        </IonText>
                                    </IonLabel>
                                )}
                            </IonItem>
                            {endedAtFieldState.isTouched && endedAtFieldState.error && (
                                <IonText color='danger' className='text-xs block pl-2 mt-1'>
                                    {endedAtFieldState.error.message}
                                </IonText>
                            )}
                        </div>
                    </div>

                    <div className='text-center py-2'>
                        <div className='flex items-center justify-center'>
                            <IonIcon icon={timeOutline} className='text-neutral-400 mr-2 text-xl' />
                            <IonText className='oswald-font text-3xl block font-bold text-green-600'>{totalHoursEnded}.{minutesEnded}</IonText>
                            <IonText className='oswald-font text-neutral-600 text-lg font-normal ml-2'>hours</IonText>
                        </div>
                        <IonText className='albert-font text-neutral-500 text-sm block'>Studied times</IonText>
                    </div>

                    <div className='block pt-3 text-center'>
                        <IonButton mode="ios" shape="round" color={'dark'} onClick={() => saveHandler()}>
                            <IonIcon icon={checkmarkOutline} slot='start' className='mr-2' />
                            <IonText>Confirm</IonText>
                        </IonButton>
                    </div>
                </div>
            </IonModal>

            {/* select date */}
            <IonModal
                ref={selectDatetimeModal}
                isOpen={showSelectDatetimeModal.isOpen}
                className='auto-height select-date confirm-datetime-modal'
                onWillDismiss={() => {
                    if (showSelectDatetimeModal.type === 'startedAt') {
                        startedAtField.onBlur();
                    } else {
                        endedAtField.onBlur();
                    }
                    setShowSelectDatetimeModal({ isOpen: false, type: 'startedAt' });
                    setSelectedDateTemp(undefined);
                }}
            >
                <IonHeader className="ion-no-border">
                    <IonToolbar color={'light'} className='borderless'>
                        <div className="ion-padding-start" slot="start">
                            <IonButton color="light" shape='round' onClick={() => selectDatetimeModal.current?.dismiss()}>
                                <IonIcon slot="icon-only" icon={closeOutline}></IonIcon>
                            </IonButton>
                        </div>

                        <IonTitle className="text-center text-base ion-text-center">
                            {showSelectDatetimeModal.type === 'startedAt' ? 'Select Started At' : 'Select Ended At'}
                        </IonTitle>

                        <div className="ion-padding-end" slot="end">
                            <IonButton
                                color="dark"
                                className='normal-button'
                                shape='round'
                                disabled={!selectedDateTemp}
                                onClick={() => {
                                    confirmDateHandler();
                                    selectDatetimeModal.current?.dismiss();
                                }}
                            >
                                <IonIcon slot="icon-only" icon={checkmarkOutline}></IonIcon>
                            </IonButton>
                        </div>
                    </IonToolbar>
                </IonHeader>

                <div className='ion-padding' style={{ 'backgroundColor': '#f4f5f8' }}>
                    <IonCard className='rounded-2xl'>
                        <IonCardContent>
                            <IonDatetime
                                color={'dark'}
                                size='cover'
                                presentation='date-time'
                                hourCycle='h24'
                                minuteValues={'0,15,30,45'}
                                max={today}
                                value={selectedDateTemp}
                                onIonChange={(e) => selectDateHandler(e)}>
                            </IonDatetime>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonModal>
        </IonPage>
    )
}

export default SessionDetailPage;