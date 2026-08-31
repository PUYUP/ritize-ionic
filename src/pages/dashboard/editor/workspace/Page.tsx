import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonPage, IonRadio, IonRadioGroup, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { briefcaseOutline } from 'ionicons/icons';
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import './Page.css';
import { authClient } from '../../../../utils/authClient';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useCreateOrganizationMutation, useGetOrganizationByIdQuery, useUpdateOrganizationMutation } from '../../../../services/organization';

type Inputs = {
    name: string
    scope: 'personal' | 'group'
}

interface RouteParams {
    id?: string
    [key: string]: string | undefined
}

const WorkspaceEditorPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const [updateOrganization, { isLoading: updating }] = useUpdateOrganizationMutation();
    const [createOrganization, { isLoading: creating }] = useCreateOrganizationMutation();
    const { data: workspace, error, isLoading, isSuccess } = useGetOrganizationByIdQuery(id ?? "", {
        skip: !id,
    });

    const {
        control,
        setValue,
        handleSubmit,
        trigger,
        formState: { errors, isValid, isSubmitting, isSubmitSuccessful },
        reset,
    } = useForm<Inputs>({
        mode: 'onChange',
        defaultValues: { name: '', scope: 'personal' },
    });

    const onSubmit: SubmitHandler<Inputs> = async (values) => {
        if (workspace) {
            // update workspace
            const { data, error } = await updateOrganization({
                id: workspace.id,
                data: {
                    name: values.name,
                    metadata: {
                        scope: values.scope,
                    },
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
        const { data, error } = await createOrganization({
            name: values.name,
            metadata: {
                scope: values.scope,
            },
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
            setValue('name', workspace.name);
            setValue('scope', workspace.metadata.scope);
            await trigger();
        })();
    }, [workspace, isSuccess, setValue, trigger]);

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        Workspace Editor
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className='ion-padding'>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className='block ion-margin-bottom'>
                        <Controller
                            name="name"
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
                                    label="Workspace name"
                                    placeholder="Enter workspace name"
                                    labelPlacement="floating"
                                    fill="outline"
                                >
                                    <IonIcon slot="start" icon={briefcaseOutline} aria-hidden="true"></IonIcon>
                                </IonTextarea>
                            )}
                        />
                        {errors.name && <IonText color="danger" className='text-xs mt-2'>Name is required</IonText>}
                    </div>

                    <div className='block'>
                        <Controller
                            name="scope"
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <IonRadioGroup value={value} onIonChange={(e) => onChange(e.detail.value)}>
                                    <IonList className='ion-no-padding'>
                                        <IonItemDivider>
                                            {value}
                                            <IonLabel>Select a workspace scope</IonLabel>
                                        </IonItemDivider>

                                        <IonItem className='ion-no-padding'>
                                            <IonRadio color="dark" value="personal" labelPlacement="end" justify="start">Personal</IonRadio>
                                        </IonItem>
                                        <IonItem lines='none' className='ion-no-padding'>
                                            <IonRadio color="dark" value="group" labelPlacement="end" justify="start">Group</IonRadio>
                                        </IonItem>
                                    </IonList>
                                </IonRadioGroup>
                            )}
                        />
                    </div>

                    <div className='mt-8 text-center'>
                        <IonButton
                            type="submit"
                            shape='round'
                            mode='ios'
                            disabled={!isValid || updating || creating}
                        >
                            {updating || creating ? (
                                <>
                                    <IonSpinner name="crescent" slot="start" />
                                    <span className='ion-margin-start'>Processing...</span>
                                </>
                            ) : (
                                !workspace ? 'Create Workspace' : 'Update Workspace'
                            )}
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonPage>
    );
};

export default WorkspaceEditorPage;