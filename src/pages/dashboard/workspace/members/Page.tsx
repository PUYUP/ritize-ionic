import { IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonPage, IonSpinner, IonTitle, IonToolbar } from "@ionic/react";
import { add, checkmarkOutline, close, settings, settingsOutline } from "ionicons/icons";
import { useParams } from "react-router";
import { useGetMembersByOrganizationIdQuery } from "../../../../services/member";
import { useRef } from "react";
import type { OverlayEventDetail } from '@ionic/core';

interface RouteParams {
    id?: string;
    [key: string]: string | undefined
}

const WorkspaceMembersPage: React.FC = () => {
    const { id } = useParams<RouteParams>();
    const { data: memberData, error, isLoading } = useGetMembersByOrganizationIdQuery(id ?? "", {
        skip: !id,
    });

    const modal = useRef<HTMLIonModalElement>(null);

    // ...
    // add member dialog dismiss listener
    // ...
    const onWillDismiss = (event: CustomEvent<OverlayEventDetail>) => {
        if (event.detail.role === 'confirm') {
            console.log(event.detail.data);
        }
    };

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        Workspace Members
                    </IonTitle>
                    <IonButtons slot="end" className="ion-padding-end">
                        <IonButton fill='clear' shape="round" id="add-members-modal">
                            <IonIcon icon={add} className='text-2xl' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className='ion-padding'>
                {isLoading ? (
                    <div className='h-full w-full flex items-center justify-center'>
                        <IonSpinner />
                    </div>
                ) : (
                    <IonList lines="none">
                        {memberData?.members?.map((member) => (
                            <IonItem key={member.id} className="ion-no-padding" style={{ '--inner-padding-end': '0px' }}>
                                <IonLabel>
                                    {member.user?.name}
                                    <p className='flex flex-wrap gap-2 items-center !mt-1'>
                                        <span className="px-2 py-1 border border-orange-300 rounded-full bg-orange-100 text-orange-600 block leading-3">{member.role}</span>
                                    </p>
                                </IonLabel>
                                <IonButtons slot="end">
                                    <IonButton fill="clear">
                                        <IonIcon icon={settingsOutline} />
                                    </IonButton>
                                </IonButtons>
                            </IonItem>
                        ))}
                    </IonList>
                )}
            </IonContent>

            <IonModal ref={modal} trigger="add-members-modal" onWillDismiss={(event) => onWillDismiss(event)}>
                <IonHeader className="ion-no-border">
                    <IonToolbar>
                        <IonButtons slot="start" className="ion-padding-start">
                            <IonButton className="!m-0" fill='clear' shape="round" onClick={() => modal.current?.dismiss()}>
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                        <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                            Add Members
                        </IonTitle>
                        <IonButtons slot="end" className="ion-padding-end">
                            <IonButton className="!m-0" fill="solid" strong={true} color="success" shape="round" onClick={() => confirm()}>
                                <IonIcon icon={checkmarkOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">

                </IonContent>
            </IonModal>
        </IonPage>
    );
};

export default WorkspaceMembersPage;