import { IonButton, IonIcon, IonText } from "@ionic/react";
import {
    addOutline,
    analyticsOutline,
    bookOutline,
    calendarClear,
    calendarClearOutline,
    calendarOutline,
    timeOutline
} from "ionicons/icons";

type Props = {
    totalMinutes?: number;
    totalNotes?: number;
    totalWorkspaces?: number;
}

const LearnStats: React.FC<Props> = ({ totalMinutes = 0, totalNotes = 0, totalWorkspaces = 0 }) => {
    return (
        <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
            <div className="block">
                <IonText className="text-sm albert-font text-neutral-500 !font-normal">Study times</IonText>
            </div>
            <div className="flex justify-start items-center">
                <div className="flex-none w-10">
                    <IonButton shape="round" mode="md" size="small" color="warning" routerLink={'/dashboard/editor/session'}>
                        <IonIcon icon={addOutline} slot="icon-only" />
                    </IonButton>
                </div>

                <div className="block">
                    <IonText className="text-5xl font-bold albert-font -tracking-[2px]">15.452</IonText>
                    <IonText className="text-base text-neutral-500 oswald-font font-light">.30 hrs</IonText>
                </div>
            </div>
        </div>
    );
}

export default LearnStats;