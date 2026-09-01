import { IonActionSheet, IonAlert, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonModal, IonPage, IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter } from "@ionic/react";
import { add, checkmarkOutline, close, closeOutline, logOutOutline, mailOutline, pencilOutline, settingsOutline, trashOutline } from "ionicons/icons";
import { useParams } from "react-router";
import { useAddMembersToOrganizationMutation, useGetMembersByOrganizationIdQuery, useLazyGetSingleMemberByOrganizationIdAndUserIdQuery, useRemoveMemberMutation } from "../../../../services/member";
import { useEffect, useRef, useState } from "react";
import type { OverlayEventDetail } from '@ionic/core';
import { Controller, useFieldArray, useForm } from "react-hook-form";
import './Page.css';
import { useLazyGetUsersQuery } from "../../../../services/user";
import { getUser } from "../../../../utils/authState";

interface RouteParams {
    id?: string;
    [key: string]: string | undefined
}

type MemberTypes = {
    readonly id: string;
    role: "member" | "admin" | "owner";
    userId: string;
    user?: any;
    email: string;
    organizationId: string;
}

type FormValues = {
    members: MemberTypes[];
};

const WorkspaceMembersPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { id } = useParams<RouteParams>();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [getSingleMember] = useLazyGetSingleMemberByOrganizationIdAndUserIdQuery();
    const [getUsers, { isLoading: gettingUsers }] = useLazyGetUsersQuery();
    const { data: memberData, error, isLoading } = useGetMembersByOrganizationIdQuery(id ?? "", {
        skip: !id,
    });
    const [addMembersToOrganization, { isLoading: addingMembers }] = useAddMembersToOrganizationMutation();
    const [removeMember, { isLoading: removingMember }] = useRemoveMemberMutation();

    const modal = useRef<HTMLIonModalElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    // ...
    // member dialog
    // ...
    const [showAddMembersModal, setShowAddMembersModal] = useState<boolean>(false);
    const [editMember, setEditMember] = useState<Partial<MemberTypes> | null>(null);
    const [showMemberActionSheet, setShowMemberActionSheet] = useState<boolean>(false);
    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [showLeaveAlert, setShowLeaveAlert] = useState(false);

    // ...
    // add member dialog dismiss listener
    // ...
    const onDidDismiss = (event: CustomEvent<OverlayEventDetail>) => {
        setShowAddMembersModal(false);
        setEditMember(null);
    };

    // ...
    // members form builder
    // ...
    const { register, control, handleSubmit, setError, clearErrors, reset, formState: { errors } } = useForm<FormValues>({
        defaultValues: {
            members: [{ role: "member", userId: "", email: "", organizationId: id ?? "" }],
        },
    });

    const { fields, append, remove, update } = useFieldArray(
        {
            control,
            name: "members",
        }
    );

    // ...
    // send data to server
    // ...
    const onSubmit = async (data: FormValues) => {
        const emails = data.members.map((m) => m.email.trim().toLowerCase());

        const { data: usersData, error } = await getUsers({ emails });

        if (error) {
            console.error(error);
            return;
        }

        const userByEmail = new Map(
            (usersData ?? []).map((u) => [u.email.toLowerCase(), u])
        );

        let hasNotFound = false;

        // bangun array baru, JANGAN andalkan `data.members` lagi setelah ini
        const resolvedMembers = data.members.map((member, index) => {
            const email = member.email.trim().toLowerCase();
            const matchedUser = userByEmail.get(email);

            const resolved = {
                ...member,
                userId: matchedUser?.id ?? "",
            };

            update(index, resolved); // sinkronkan UI/state form

            if (matchedUser) {
                clearErrors(`members.${index}.email`);
            } else {
                hasNotFound = true;
            }

            return resolved;
        });

        if (hasNotFound) {
            return; // biarkan user perbaiki email yang salah
        }

        const res = await addMembersToOrganization({
            organizationId: id as string,
            members: resolvedMembers, // pakai ini, bukan data.members
        });

        if (res.error) {
            const results = (res.error as any).details?.results ?? [];
            results.forEach((result: any, index: number) => {
                setError(`members.${index}.email`, {
                    type: "error",
                    message: result.error,
                });
            });
            return;
        }

        modal.current?.dismiss({ role: 'submit' });
    };

    // ...
    // set current member to edit
    // ...
    useEffect(() => {
        if (editMember) {
            update(0, {
                id: editMember.id as string,
                email: editMember.user.email ?? "",
                role: editMember.role ?? "member",
                userId: editMember.userId ?? "",
                organizationId: editMember.organizationId ?? ""
            });
        } else {
            reset();
        }
    }, [editMember]);

    useEffect(() => {
        (async () => {
            const user = await getUser();

            const { data, error } = await getSingleMember({ organizationId: id as string, userId: user.id });
            if (data) setCurrentUser(data);
        })();
    }, []);

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
                        <IonButton fill='clear' shape="round" disabled={addingMembers} onClick={() => setShowAddMembersModal(true)}>
                            <IonIcon icon={add} className='text-2xl' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className='ion-padding'>
                {isLoading || !currentUser ? (
                    <div className='h-full w-full flex items-center justify-center'>
                        <IonSpinner />
                    </div>
                ) : (
                    <IonList lines="none">
                        {memberData?.members?.map((member) => (
                            <IonItem key={member?.id} className="ion-no-padding" style={{ '--inner-padding-end': '0px', '--min-height': '68px' }}>
                                <IonLabel>
                                    {member?.user?.name}
                                    <span className={`px-2 py-1 text-sm font-semibold ${member?.role === 'owner' ? 'text-blue-600' : member?.role === 'admin' ? 'text-purple-600' : 'text-orange-600'} leading-3`}>{member?.role}</span>
                                    <p>{member?.user?.email}</p>
                                </IonLabel>
                                <div slot="end" className="flex items-center gap-2">
                                    <IonButtons className="gap-2">
                                        {(currentUser.role === 'member' || currentUser.role === 'admin') && currentUser.userId === member.userId && (
                                            <IonButton fill="clear" onClick={() => {
                                                setEditMember(member);
                                                setShowLeaveAlert(true);
                                            }}>
                                                <IonIcon icon={logOutOutline} color="danger" />
                                            </IonButton>
                                        )}

                                        {(currentUser.role === 'owner' || currentUser.role === 'admin') && member.role !== 'owner' && (
                                            <IonButton fill="clear" onClick={() => {
                                                setEditMember(member);
                                                setShowMemberActionSheet(true);
                                            }}>
                                                <IonIcon icon={settingsOutline} />
                                            </IonButton>
                                        )}
                                    </IonButtons>
                                </div>
                            </IonItem>
                        ))}
                    </IonList>
                )}
            </IonContent>

            <IonModal ref={modal} isOpen={showAddMembersModal} onDidDismiss={(event) => onDidDismiss(event)}>
                <IonHeader className="ion-no-border">
                    <IonToolbar>
                        <IonButtons slot="start" className="ion-padding-start">
                            <IonButton className="!m-0" fill='clear' shape="round" onClick={() => modal.current?.dismiss()}>
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                        <IonTitle className="text-base text-center fixed left-14 right-14 top-0 bottom-0 text-lg">
                            {editMember ? 'Edit ' + editMember.user?.name : 'Add Members'}
                        </IonTitle>
                        <IonButtons slot="end" className="ion-padding-end">
                            <IonButton
                                className="!m-0"
                                fill="solid"
                                strong={true}
                                color="success"
                                shape="round"
                                onClick={() => handleSubmit(onSubmit)()}
                                disabled={addingMembers || gettingUsers}
                            >
                                {!addingMembers && !gettingUsers ? (
                                    <IonIcon icon={checkmarkOutline} />
                                ) : (
                                    <IonSpinner name="crescent" className="text-xl" />
                                )}
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
                        {fields.map((field, index) => (
                            <IonCard key={field.id} className="rounded-xl p-2 !mb-4">
                                <IonCardContent>
                                    <Controller
                                        name={`members.${index}.email` as const}
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field: { onChange, onBlur, value, ref } }) => (
                                            <IonInput
                                                ref={ref}
                                                value={value}
                                                onIonInput={(e) => onChange(e.detail.value)}
                                                onIonBlur={onBlur}
                                                color="dark"
                                                label="User Email"
                                                placeholder="Enter email"
                                                labelPlacement="floating"
                                                fill="outline"
                                                className="ion-margin-bottom small-input"
                                                type="email"
                                            >
                                                <IonIcon slot="start" icon={mailOutline} aria-hidden="true"></IonIcon>
                                            </IonInput>
                                        )}
                                    />

                                    <Controller
                                        name={`members.${index}.role` as const}
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field: { onChange, onBlur, value, ref } }) => (
                                            <IonSelect
                                                interface="popover"
                                                ref={ref}
                                                value={value}
                                                onIonChange={(e) => onChange(e.detail.value)}
                                                onIonBlur={onBlur}
                                                color="dark"
                                                label="Role"
                                                placeholder="Select a role"
                                                labelPlacement="floating"
                                                fill="outline"
                                                className="small-input"
                                            >
                                                <IonSelectOption value="member">Member</IonSelectOption>
                                                <IonSelectOption value="admin">Admin</IonSelectOption>
                                            </IonSelect>
                                        )}
                                    />

                                    <input
                                        {...register(`members.${index}.organizationId` as const)}
                                        placeholder="Org ID"
                                        type="hidden"
                                    />

                                    <input
                                        {...register(`members.${index}.userId` as const)}
                                        placeholder="User ID"
                                        type="hidden"
                                    />

                                    {errors.members?.[index]?.email?.type === "error" && (
                                        <IonText color="danger" className="ion-text-sm">
                                            {errors.members[index]?.email?.message}
                                        </IonText>
                                    )}

                                    {!editMember && (
                                        <div className="ion-text-center pt-6">
                                            <IonButton fill="clear" size="small" type="button" mode="ios" color="danger" onClick={() => remove(index)}>
                                                <IonIcon icon={close} slot="start" />
                                                <IonText>{editMember ? "Remove this member" : "Remove"}</IonText>
                                            </IonButton>
                                        </div>
                                    )}
                                </IonCardContent>
                            </IonCard>
                        ))}

                        {!editMember && (
                            <div className="ion-text-center mt-8">
                                <IonButton
                                    type="button"
                                    shape="round"
                                    color={'dark'}
                                    onClick={() => append({
                                        role: "member",
                                        id: "",
                                        userId: "",
                                        email: "",
                                        organizationId: id ?? ""
                                    })}
                                >
                                    <IonIcon icon={add} slot="start" />
                                    <IonText>Add</IonText>
                                </IonButton>
                            </div>
                        )}
                    </form>
                </IonContent>
            </IonModal>

            {/* remove member alert */}
            <IonAlert
                isOpen={showRemoveAlert}
                onDidDismiss={() => {
                    setEditMember(null);
                    setShowRemoveAlert(false)
                }}
                header={`Are you sure to remove ${editMember?.user?.name} as member?`}
                message={'This action cannot be undone.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            const { data, error } = await removeMember({
                                organizationId: editMember?.organizationId ?? '',
                                memberIdOrEmail: editMember?.id ?? '',
                            })

                            if (error) {
                                return;
                            }

                            setEditMember(null);
                            setShowRemoveAlert(false)
                        },
                    },
                ]}
            ></IonAlert>

            {/* leave org alert */}
            <IonAlert
                isOpen={showLeaveAlert}
                onDidDismiss={() => {
                    setEditMember(null);
                    setShowLeaveAlert(false)
                }}
                header={`Are you sure to leave this workspace?`}
                message={'This action cannot be undone.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            const { data, error } = await removeMember({
                                organizationId: editMember?.organizationId ?? '',
                                memberIdOrEmail: editMember?.id ?? '',
                            })

                            if (error) {
                                return;
                            }

                            setEditMember(null);
                            setShowLeaveAlert(false);
                            ionRouter.navigateRoot('/dashboard');
                        },
                    },
                ]}
            ></IonAlert>

            <IonActionSheet
                isOpen={showMemberActionSheet}
                onDidDismiss={() => setShowMemberActionSheet(false)}
                header="Member Actions"
                buttons={[
                    {
                        text: 'Edit',
                        icon: pencilOutline,
                        data: {
                            action: 'edit',
                        },
                        handler: () => {
                            setShowAddMembersModal(true);
                            setShowMemberActionSheet(false);
                        }
                    },
                    {
                        text: 'Remove',
                        icon: trashOutline,
                        role: 'destructive',
                        data: {
                            action: 'delete',
                        },
                        handler: () => {
                            setShowRemoveAlert(true);
                            setShowMemberActionSheet(false);
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
        </IonPage>
    );
};

export default WorkspaceMembersPage;