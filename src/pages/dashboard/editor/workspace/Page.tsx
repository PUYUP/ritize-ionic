import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonPage, IonRadio, IonRadioGroup, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import { briefcaseOutline } from 'ionicons/icons';
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import './Page.css';
import { authClient } from '../../../../utils/authClient';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../../../../utils/supabaseClient';

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

    const [loading, setLoading] = useState(false);
    const [workspace, setWorkspace] = useState<any>();

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
        if (!id) return;

        const getWorkspace = async () => {
            setLoading(true);

            const { data, error } = await supabase
                .from('ba_organizations')
                .select(`
                    *,
                    members:ba_organization_members!inner(*)
                `)
                .eq('id', id)
                .single();

            if (error) return;

            const metadata = data.metadata ? JSON.parse(data.metadata) : null;
            setWorkspace({ ...data, metadata });

            setValue('name', data.name);
            setValue('scope', metadata?.scope ?? 'personal');

            await trigger();

            setLoading(false);
        };

        getWorkspace();
    }, [id, setValue]);

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