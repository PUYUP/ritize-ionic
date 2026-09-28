import { IonButton, IonIcon, IonText } from "@ionic/react";
import { intervalToDuration } from "date-fns";
import { addOutline, chevronForwardOutline } from "ionicons/icons";

type Props = {
    durationSeconds?: number;
}

const LearnStats: React.FC<Props> = ({ durationSeconds = 0 }) => {
    const duration = intervalToDuration({
        start: 0,
        end: (durationSeconds ?? 0) * 1000 // intervalToDuration expects milliseconds
    });

    const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
    const minutes = duration.minutes ?? 0;

    return (
        <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="block">
                        <IonText className="text-sm albert-font text-neutral-500 !font-normal">Studied times</IonText>
                    </div>
                    <div className="flex justify-start items-center">
                        <div className="flex-none w-10">
                            <IonButton shape="round" mode="md" size="small" color="warning" routerLink={'/dashboard/editor/session'}>
                                <IonIcon icon={addOutline} slot="icon-only" />
                            </IonButton>
                        </div>

                        <div className="block">
                            <IonText className="text-5xl font-bold albert-font -tracking-[2px]">{totalHours}</IonText>
                            <IonText className="text-xl text-neutral-500 oswald-font font-light">.{minutes} hrs</IonText>
                        </div>
                    </div>
                </div>

                <div className="ml-auto">
                    <IonButton fill="clear" mode='ios' routerLink={"/dashboard/reward"}>
                        <div className="flex">
                            <div className="flex flex-col">
                                <IonText className="text-sm text-neutral-400">Get token</IonText>
                                <IonText className="text-left oswald-font text-2xl uppercase leading-4 font-bold text-purple-600 tracking-widest">Free</IonText>
                            </div>

                            <div className="flex items-end justify-center">
                                <IonIcon icon={chevronForwardOutline} color="dark" className="text-lg relative top-0.5" />
                            </div>
                        </div>
                    </IonButton>
                </div>
            </div>
        </div>
    );
}

export default LearnStats;