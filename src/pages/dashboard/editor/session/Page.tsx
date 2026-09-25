import { IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonDatetime, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonPage, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar, useIonRouter, useIonViewDidEnter, useIonViewWillEnter } from '@ionic/react';
import './Page.css';
import { checkmarkOutline, closeOutline, timeOutline, timeSharp } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { useGetAllWorkspacesQuery, WorkspaceTypes } from '../../../../services/workspace';
import { format } from 'date-fns';
import { LearningSessionTypes, useCreateSessionMutation, useGetLearningSessionByIdQuery, useLazyGetLearningSessionByIdQuery, useUpdateSessionMutation } from '../../../../services/learning.session';
import { getUser } from '../../../../utils/authState';
import { useParams } from 'react-router';

type SessionFormValues = {
    workspace: WorkspaceTypes | null;
    startedAt: string | undefined;
    endedAt: string | undefined;
    topic: string;
}

interface RouteParams {
    id?: string
    sessionId?: string
    [key: string]: string | undefined
}

function SessionEditorPage() {
    const ionRouter = useIonRouter();

    // Parameter dari URL
    const { id: workspaceId, sessionId } = useParams<RouteParams>();

    // Mutation
    const [createSession, { isLoading }] = useCreateSessionMutation();
    const [updateSession, { isLoading: isUpdating }] = useUpdateSessionMutation();

    // Workspaces select modal
    const workspaceModalRef = useRef<HTMLIonModalElement>(null);
    const [showWorkspacesModal, setShowWorkspacesModal] = useState(false);

    // Getting workspace from database
    const { data: workspaces, isFetching: isFetchingWorkspaces } = useGetAllWorkspacesQuery({ from: 0, to: 1000 });

    // Start and end date (UI-only temp state used while a date is being picked)
    const today = new Date().toISOString().substring(0, 10);
    const [selectedDateTemp, setSelectedDateTemp] = useState<string>();
    const selectDatetimeModal = useRef<HTMLIonModalElement>(null);
    const [showSelectDatetimeModal, setShowSelectDatetimeModal] = useState<{ isOpen: boolean; type: 'startedAt' | 'endedAt' }>({ isOpen: false, type: 'startedAt' });

    // RTK Query
    const [sessionData, setSessionData] = useState<LearningSessionTypes | null>(null);
    const [getSession] = useLazyGetLearningSessionByIdQuery();

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
            workspace: null,
            startedAt: undefined,
            endedAt: undefined,
            topic: '',
        },
    });

    const startedAtValue = watch('startedAt');

    const { field: workspaceField, fieldState: workspaceFieldState } = useController({
        control,
        name: 'workspace',
        rules: { required: 'Select a class to continue' },
    });

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

    const { field: topicField } = useController({
        control,
        name: 'topic',
    });

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
            user_id: user.id,
            workspace_id: data.workspace?.id ?? '',
            started_at: data.startedAt,
            ended_at: data.endedAt,
            title: data.topic,
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
        } else {
            const { data: res, error } = await createSession({ body: payload });
            if (error) {
                return;
            }

            result = res;
        }

        reset();
        setSelectedDateTemp(undefined);
        setShowSelectDatetimeModal({ isOpen: false, type: 'startedAt' });
        setShowWorkspacesModal(false);

        // redirect to session detail
        if (result) {
            ionRouter.push(`/dashboard/workspace/${result.workspace_id}/sessions/${result.id}`);
        }
    };

    // Page lifecycle
    useIonViewDidEnter(() => {
        reset({
            workspace: null,
            startedAt: undefined,
            endedAt: undefined,
            topic: '',
        });
        setSelectedDateTemp(undefined);
        setShowSelectDatetimeModal({ isOpen: false, type: 'startedAt' });
        setShowWorkspacesModal(false);
        // populate formState.isValid immediately so the submit button
        // starts out disabled rather than waiting for the first interaction
        trigger();
    }, []);

    useIonViewWillEnter(() => {
        (async () => {
            if (sessionId) {
                const { data, error } = await getSession(sessionId);
                if (error) {
                    return;
                }

                if (data) {
                    setSessionData(data);
                }
            }
        })();
    }, [sessionId])

    // Effect handler
    useEffect(() => {
        if (sessionData) {
            setValues({
                workspace: sessionData.workspace,
                startedAt: sessionData.started_at,
                endedAt: sessionData.ended_at,
                topic: sessionData.title,
            }, {
                shouldValidate: true,
            });
        }
    }, [sessionData, reset]);

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color='light' className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end ion-text-center'>
                        {sessionData ? `Edit Study Session` : 'New Study Session'}
                    </IonTitle>

                    <div slot="end" className="ion-padding-end">
                        <IonButton
                            shape="round"
                            mode="md"
                            color="dark"
                            className='normal-button'
                            disabled={!isValid || isSubmitting || isLoading}
                            onClick={handleSubmit(onSubmit)}
                        >
                            {(isSubmitting || isLoading) && <IonSpinner name="crescent" slot='icon-only' />}
                            {!isSubmitting && !isLoading && <IonIcon icon={checkmarkOutline} slot='icon-only' />}
                        </IonButton>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'}>
                <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    <div className='ion-padding !pb-2'>
                        <IonItem
                            lines="none"
                            mode='ios'
                            detail={true}
                            button={true}
                            className='select-workspace p-2.5 -mx-2.5'
                            onClick={() => setShowWorkspacesModal(true)}
                            disabled={isFetchingWorkspaces}
                        >
                            {workspaceField.value ? (
                                <IonLabel>
                                    <p className='!text-sm'>Selected class</p>
                                    <IonText className='albert-font'>{workspaceField.value.title}</IonText>
                                </IonLabel>
                            ) : (
                                <IonLabel>
                                    <p className='!text-sm'>Select a class</p>
                                    <IonText className='albert-font'>No class selected</IonText>
                                </IonLabel>
                            )}
                        </IonItem>
                        {workspaceFieldState.isTouched && workspaceFieldState.error && (
                            <IonText color='danger' className='text-xs block ion-padding-start mt-1'>
                                {workspaceFieldState.error.message}
                            </IonText>
                        )}
                    </div>

                    <div className='flex ion-padding-start ion-padding-end'>
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
                                onClick={() => setShowSelectDatetimeModal({ isOpen: true, type: 'startedAt' })}
                                disabled={isFetchingWorkspaces}
                            >
                                {startedAtField.value ? (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0'>{format(new Date(startedAtField.value), 'MMM dd, yyyy')}</p>
                                        <IonText className='text-base albert-font'>{format(new Date(startedAtField.value), 'HH:mm')}</IonText>
                                    </IonLabel>
                                ) : (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0'>Select date</p>
                                        <IonText className='text-base albert-font !font-normal'>Not selected</IonText>
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
                                onClick={() => setShowSelectDatetimeModal({ isOpen: true, type: 'endedAt' })}
                                disabled={isFetchingWorkspaces || !startedAtField.value}
                            >
                                {endedAtField.value ? (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0'>{format(new Date(endedAtField.value), 'MMM dd, yyyy')}</p>
                                        <IonText className='text-base albert-font'>{format(new Date(endedAtField.value), 'HH:mm')}</IonText>
                                    </IonLabel>
                                ) : (
                                    <IonLabel>
                                        <p className='!text-sm !mb-0'>Select date</p>
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

                    <div className='ion-padding'>
                        <IonTextarea
                            fill='outline'
                            color={'dark'}
                            labelPlacement='floating'
                            label="Topic learned (optional)"
                            autoGrow={true}
                            value={topicField.value}
                            onIonInput={(e) => topicField.onChange(e.detail.value ?? '')}
                            onIonBlur={topicField.onBlur}
                        ></IonTextarea>
                    </div>
                </div>
            </IonContent>

            {/* select workspaces */}
            <IonModal
                ref={workspaceModalRef}
                isOpen={showWorkspacesModal}
                onWillDismiss={() => {
                    workspaceField.onBlur();
                    setShowWorkspacesModal(false);
                }}
            >
                <IonHeader className='ion-no-border'>
                    <IonToolbar color={'light'} className='borderless'>
                        <div slot="start" className='ion-padding-start'>
                            <IonButton shape='round' color='light' onClick={() => workspaceModalRef.current?.dismiss()}>
                                <IonIcon icon={closeOutline} slot='icon-only' color='dark' />
                            </IonButton>
                        </div>
                        <IonTitle className='ion-text-center text-base absolute left-14 right-14 top-0 bottom-0'>Select a class</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonContent color={'light'} className='ion-padding'>
                    <div className='!p-0 bg-none ion-no-background !flex flex-col gap-0'>
                        {workspaces?.map(item => {
                            return (
                                <IonItem
                                    key={item.id}
                                    button
                                    lines='full'
                                    mode='ios'
                                    detail={true}
                                    className='p-2 -mx-2 clear'
                                    onClick={() => {
                                        workspaceField.onChange(item);
                                        workspaceModalRef.current?.dismiss();
                                    }}
                                >
                                    <IonLabel className='ion-padding-end'>
                                        <p className='!text-sm !mb-0.5 flex items-center gap-1'>
                                            <IonIcon icon={timeSharp} slot='start' className='text-neutral-300' />
                                            <IonText>28 hours</IonText>
                                        </p>
                                        <IonText className='albert-font'>{item.title}</IonText>
                                    </IonLabel>
                                </IonItem>
                            )
                        })}
                    </div>
                </IonContent>
            </IonModal>

            <IonModal
                ref={selectDatetimeModal}
                isOpen={showSelectDatetimeModal.isOpen}
                className='auto-height select-date'
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
    );
}

export default SessionEditorPage;