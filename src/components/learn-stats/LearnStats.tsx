import { IonButton, IonIcon, IonText } from "@ionic/react";
import { intervalToDuration } from "date-fns";
import { addOutline } from "ionicons/icons";

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
                    <IonText className="text-base text-neutral-500 oswald-font font-light">.{minutes} hrs</IonText>
                </div>
            </div>
        </div>
    );
}

export default LearnStats;