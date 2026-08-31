import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonPage, IonRadio, IonRadioGroup, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { briefcaseOutline } from 'ionicons/icons';
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import './Page.css';
import { authClient } from '../../../../utils/authClient';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useGetOrganizationByIdQuery } from '../../../../services/organization';

type Inputs = {
    name: string
    scope: string
}

interface RouteParams {
    id?: string
    [key: string]: string | undefined
}

const WorkspaceEditorPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
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
        const metadata = { scope: values.scope };

        if (workspace) {
            // update workspace
            const { data, error } = await authClient.organization.update({
                data: {
                    name: values.name,
                    metadata,
                },
                organizationId: workspace.id,
            });

            if (error) return;

            ionRouter.push(`/dashboard/workspace/${data.id}?name=${data.name}`, 'forward', 'push');
            return;
        }

        // create workspace
        const { data, error } = await authClient.organization.create({
            name: values.name,
            slug: values.name.toLowerCase(),
            metadata,
            keepCurrentActiveOrganization: false,
        });

        if (error) return;

        if (data) {
            ionRouter.push(`/dashboard/workspace/${data.id}?name=${data.name}`, 'forward', 'push');
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
                                <IonInput
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
                                </IonInput>
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
                            disabled={!isValid || isSubmitting}
                        >
                            {isSubmitting ? (
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