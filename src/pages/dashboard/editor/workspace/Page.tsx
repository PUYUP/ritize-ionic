import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonPage, IonRadio, IonRadioGroup, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { briefcaseOutline } from 'ionicons/icons';
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import './Page.css';

type Inputs = {
    name: string
    scope: string
}

const WorkspaceEditorPage: React.FC = () => {
    const {
        control,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<Inputs>({
        mode: 'onChange',
        defaultValues: { name: '', scope: 'personal' },
    });

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        console.log(data)
    }

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
                            disabled={!isValid}
                        >
                            Create Workspace
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonPage>
    );
};

export default WorkspaceEditorPage;