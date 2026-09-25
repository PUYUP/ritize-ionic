import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonPage, IonRadio, IonRadioGroup, IonSelect, IonSelectOption, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { briefcaseOutline, schoolOutline } from 'ionicons/icons';
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import './Page.css';
import languages from '../../../../utils/ISO-639-1-language.json';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useCreateWorkspaceMutation, useGetWorkspaceByIdQuery, useUpdateWorkspaceMutation } from '../../../../services/workspace';

type Inputs = {
    title: string
    scope: 'personal' | 'group'
    language_code: string
}

interface RouteParams {
    id?: string
    [key: string]: string | undefined
}

const WorkspaceEditorPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const [updateWorkspace, { isLoading: updating }] = useUpdateWorkspaceMutation();
    const [createWorkspace, { isLoading: creating }] = useCreateWorkspaceMutation();
    const { data: workspace, error, isLoading, isSuccess } = useGetWorkspaceByIdQuery(id ?? "", { skip: !id });

    const {
        control,
        setValue,
        handleSubmit,
        trigger,
        formState: { errors, isValid, isSubmitting, isSubmitSuccessful },
        reset,
    } = useForm<Inputs>({
        mode: 'onChange',
        defaultValues: { title: '', scope: 'personal', language_code: 'en' },
    });

    const onSubmit: SubmitHandler<Inputs> = async (values) => {
        if (workspace) {
            // update workspace
            const { data, error } = await updateWorkspace({
                id: workspace.id,
                data: {
                    title: values.title,
                    scope: values.scope,
                    language_code: values.language_code,
                },
            });

            if (error) return;

            if (ionRouter.canGoBack()) {
                ionRouter.goBack();
            } else {
                ionRouter.navigateRoot('/dashboard');
            }
            return;
        }

        // create workspace
        const { data, error } = await createWorkspace({
            title: values.title,
            scope: values.scope,
            language_code: values.language_code,
        });

        if (error) return;

        if (data) {
            ionRouter.push(`/dashboard/workspace/${data.id}`, 'forward', 'replace');
        }
    }

    useEffect(() => {
        if (isSubmitSuccessful) {
            reset();
        }

    }, [isSubmitSuccessful, reset]);

    useEffect(() => {
        if (!workspace || !isSuccess) return;

        (async () => {
            setValue('title', workspace.title);
            setValue('scope', workspace.scope);
            setValue('language_code', workspace.language_code);
            await trigger();
        })();
    }, [workspace, isSuccess, setValue, trigger]);

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        Class Editor
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent color="light" className='ion-padding'>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className='block ion-margin-bottom'>
                        <Controller
                            name="title"
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { onChange, onBlur, value, ref } }) => (
                                <IonTextarea
                                    autoGrow
                                    ref={ref}
                                    value={value}
                                    onIonInput={(e) => onChange(e.detail.value)}
                                    onIonBlur={onBlur}
                                    color="dark"
                                    label="Class name"
                                    placeholder="Enter class name"
                                    labelPlacement="floating"
                                    fill="outline"
                                    rows={1}
                                >
                                    <IonIcon slot="start" icon={schoolOutline} aria-hidden="true"></IonIcon>
                                </IonTextarea>
                            )}
                        />
                        {errors.title && <IonText color="danger" className='text-xs mt-2'>Name is required</IonText>}
                    </div>

                    <div className='block'>
                        <Controller
                            name="scope"
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <IonRadioGroup className='ion-no-background !bg-transparent' value={value} onIonChange={(e) => onChange(e.detail.value)}>
                                    <IonList className='ion-no-padding divider !bg-transparent'>
                                        <IonItemDivider className='ion-no-background !bg-transparent'>
                                            <IonLabel>Select class type</IonLabel>
                                        </IonItemDivider>

                                        <IonItem className='ion-no-padding ion-no-background !bg-transparent'>
                                            <IonRadio color="dark" value="personal" labelPlacement="end" justify="start">Personal</IonRadio>
                                            <IonText className='text-xs pt-1.5 italic text-neutral-600'>Only for you</IonText>
                                        </IonItem>
                                        <IonItem lines='none' className='ion-no-padding ion-no-background !bg-transparent'>
                                            <IonRadio color="dark" value="group" labelPlacement="end" justify="start">Group</IonRadio>
                                            <IonText className='text-xs pt-1.5 italic text-neutral-600'>Share notes with classmates</IonText>
                                        </IonItem>
                                    </IonList>
                                </IonRadioGroup>
                            )}
                        />
                    </div>

                    <div className='block ion-margin-top'>
                        <Controller
                            name="language_code"
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <div className='block'>
                                    <IonItemDivider className='divider'>
                                        <IonLabel>Main language for the class content</IonLabel>
                                    </IonItemDivider>
                                    <IonSelect
                                        labelPlacement="floating"
                                        fill="outline"
                                        mode="ios"
                                        placeholder='Select a language'
                                        onIonChange={(e) => onChange(e.detail.value)}
                                        value={value}
                                        interface="popover"
                                    >
                                        {languages.sort((a, b) => a.name.localeCompare(b.name)).map((lang) => (
                                            <IonSelectOption key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </IonSelectOption>
                                        ))}
                                    </IonSelect>
                                </div>
                            )}
                        />
                    </div>

                    <div className='mt-8 text-center'>
                        <IonButton
                            type="submit"
                            shape='round'
                            mode='ios'
                            color='dark'
                            disabled={!isValid || updating || creating}
                        >
                            {updating || creating ? (
                                <>
                                    <IonSpinner name="crescent" slot="start" />
                                    <span className='ion-margin-start'>Processing...</span>
                                </>
                            ) : (
                                !workspace ? 'Create Class' : 'Update Class'
                            )}
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonPage>
    );
};

export default WorkspaceEditorPage;