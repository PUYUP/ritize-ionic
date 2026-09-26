import { IonButton, IonCard, IonCardContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, IonText } from "@ionic/react";
import { LearningSessionTypes, useGetLearningSessionsByWorkspaceIdQuery } from "../../services/learning.session";
import { useEffect, useMemo, useState } from "react";
import { checkmarkDoneOutline, chevronForwardSharp, imageOutline, returnDownForwardSharp, shapesOutline, textOutline, timerOutline } from "ionicons/icons";
import { differenceInSeconds, format, intervalToDuration } from "date-fns";
import { getUser } from "../../utils/authState";

interface Props {
    workspaceId?: string;
}

// --- Grouping helpers (per-day, based on note_datetime) ---

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** Extract the "YYYY-MM-DD" date key from note_datetime, with no timezone conversion. */
const getDateKey = (isoString: string): string => isoString?.slice(0, 10);

/** "2026-09-05" -> "September 5, 2026" (safe from timezone shifts when parsing Date). */
const formatDateHeader = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
};

interface NoteGroup {
    index: number;
    dateKey: string;
    items: LearningSessionTypes[];
    onShowOptions?: (item: LearningSessionTypes) => void;
}

/**
 * Group items by note_datetime (per day).
 * The order of dates and items within each group follows the original API order
 * (not re-sorted), to stay consistent with pagination/infinite scroll.
 */
const groupItemsByDate = (items: LearningSessionTypes[]): NoteGroup[] => {
    const map = new Map<string, LearningSessionTypes[]>();

    for (const note of items) {
        const key = getDateKey(note.started_at);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(note);
    }

    return [...map.entries()].map(([dateKey, groupItems], index) => ({
        index,
        dateKey,
        items: groupItems,
    }));
};

const SessionItem: React.FC<{
    item: LearningSessionTypes,
    isLast: boolean,
    user: { id: string },
    workspaceId?: string,
    onShowOptions?: (item: LearningSessionTypes) => void,
}> = ({
    item,
    isLast,
    user,
    workspaceId,
    onShowOptions,
}) => {

        let linkTo: string = `/dashboard/workspace/${workspaceId}/sessions/${item.id}`;

        const optionsHandler = async (item: LearningSessionTypes) => {
            onShowOptions?.(item);
        }

        // build circle color
        let circleBackground = 'bg-neutral-200';
        let circleColor = 'text-neutral-700';
        let borderColor = 'border-neutral-300';

        if (item.status === 'completed') {
            circleBackground = 'bg-green-100';
            circleColor = 'text-green-800';
            borderColor = 'border-green-300';
        }

        let seconds = item.duration_seconds ?? 0;
        if (item.status !== 'completed') {
            seconds = differenceInSeconds(new Date(), new Date(item.started_at));
        }
        const duration = intervalToDuration({
            start: 0,
            end: seconds * 1000 // intervalToDuration expects milliseconds
        });

        // Kalikan hari dengan 24 dan tambahkan ke sisa jam
        const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
        const minutes = duration.minutes ?? 0;

        return (
            <div className='block'>
                <div className='flex items-center gap-2 w-full'>
                    <div className={`w-6 h-6 flex-none ${circleBackground} shadow-sm border ${borderColor} rounded-full relative z-10 flex items-center justify-center`}>
                        {item.status === 'ongoing' && <IonIcon icon={timerOutline} className={`text-sm ${circleColor}`} />}
                        {item.status === 'completed' && <IonIcon icon={checkmarkDoneOutline} className={`text-sm ${circleColor}`} />}
                    </div>

                    <div className='albert-font flex gap-3 items-center w-full'>
                        <div className="flex gap-2 items-center">
                            <IonText className='font-normal text-neutral-600 text-sm oswald-font'>{format(item.started_at, 'HH:mm')}</IonText>
                            <IonIcon icon={returnDownForwardSharp} className='text-neutral-500 text-sm' />

                            {item.status === 'completed' ? (
                                <IonText className='font-normal text-neutral-600 text-sm oswald-font'>{format(item.ended_at, 'HH:mm')}</IonText>
                            ) : (
                                <div className="px-1 py-0.5 leading-3 text-[10px] uppercase bg-orange-100 border border-orange-200 rounded-full font-normal text-orange-700 shadow">
                                    <IonText>ongoing</IonText>
                                </div>
                            )}
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <IonText className={`font-normal text-sm oswald-font ${item.status !== 'completed' ? 'text-orange-600' : 'text-green-600'}`}>
                                {totalHours}.{minutes}h
                            </IonText>
                        </div>
                    </div>
                </div>

                <div className='pl-8'>
                    <IonCard className="rounded-xl mt-1" routerLink={linkTo}>
                        <IonCardContent className="ion-padding">
                            {item.title ? (
                                <div className="block mb-2">
                                    <div
                                        dangerouslySetInnerHTML={{ __html: item.title }}
                                        className='text-neutral-700 text-sm leading-5 line-clamp-3'
                                    />
                                </div>
                            ) : (
                                <div className="block mb-2">
                                    <IonText className="text-neutral-500 italic text-sm leading-5 line-clamp-3">No topic provided.</IonText>
                                </div>
                            )}

                            <div className="flex w-full items-center">
                                <div className="flex-1 flex flex-row gap-4 items-center">
                                    {/* <IonText className="text-[11px] uppercase tracking-widest">Notes:</IonText> */}

                                    <div className="flex flex-row gap-1 items-end">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-6 h-6 bg-[#E1F2F1] text-[#008C88] border-[#008C88]/30 shadow border rounded-full relative z-10 flex items-center justify-center`}>
                                                <IonIcon icon={textOutline} className="text-neutral-500" />
                                            </div>

                                            <IonText className="oswald-font text-xl font-semibold pb-0.5 text-[#008C88]">{item.pages_text?.length ?? 0}</IonText>
                                        </div>
                                    </div>

                                    <div className="flex flex-row gap-1 items-end">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-6 h-6 bg-[#E9F4E5] text-[#32A315] border-[#32A315]/30 shadow border rounded-full relative z-10 flex items-center justify-center`}>
                                                <IonIcon icon={shapesOutline} className="text-neutral-500" />
                                            </div>

                                            <IonText className="oswald-font text-xl font-semibold pb-0.5 text-[#32A315]">{item.pages_canvas?.length ?? 0}</IonText>
                                        </div>
                                    </div>

                                    <div className="flex flex-row gap-1 items-end">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-6 h-6 bg-[#EEE4FA] text-[#5B00C9] border-[#5B00C9]/30 shadow border rounded-full relative z-10 flex items-center justify-center`}>
                                                <IonIcon icon={imageOutline} className="text-neutral-500" />
                                            </div>

                                            <IonText className="oswald-font text-xl font-semibold pb-0.5 text-[#5B00C9]">{item.pages_file?.length ?? 0}</IonText>
                                        </div>
                                    </div>
                                </div>

                                <div className="ml-auto">
                                    <IonButton mode="md" shape="round" size="small" color="light">
                                        <IonIcon icon={chevronForwardSharp} slot="icon-only" />
                                    </IonButton>
                                </div>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </div>
        )
    }

const LearnList: React.FC<Props> = ({ workspaceId }) => {
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [page, setPage] = useState(1);
    const [user, setUser] = useState({ id: '' });

    const { data, isFetching, isLoading, isSuccess, isError } = useGetLearningSessionsByWorkspaceIdQuery({
        workspace_id: workspaceId ?? "",
        page: page,
        pageSize: 20
    }, { skip: !workspaceId });

    const groupedNotes = useMemo(() => groupItemsByDate(data?.results ?? []), [data?.results]);
    const hasMore = (data?.results.length ?? 0) < (data?.count ?? 0);

    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching && hasMore) {
            setPage((p) => p + 1);
        }

        setIonScrollEl(e.target as HTMLIonInfiniteScrollElement);
    };

    const optionsHandler = (item: LearningSessionTypes) => {

    }

    useEffect(() => {
        if (isSuccess && !isFetching) {
            ionScrollEl?.complete();
        }
    }, [isSuccess, isFetching]);

    useEffect(() => {
        (async () => {
            const u = await getUser();
            setUser(u);
        })()
    }, [workspaceId]);

    if (isLoading && page === 1) {
        return (
            <div className="ion-padding text-center ion-padding">
                <IonText className='text-center ion-padding text-sm'>Loading...</IonText>
            </div>
        );
    }

    return (
        <>
            <div id="notelist" className='flex flex-col gap-4 notes-list ion-padding'>
                {groupedNotes.map(({ dateKey, items, index }) => (
                    <div key={dateKey} className='block flex flex-col w-full gap-4 relative'>
                        <div className='absolute left-[12px] top-6 bottom-2 border-l-1 border-dashed border-neutral-300'></div>

                        <div className='flex items-center'>
                            <div className="inline-block bg-white shadow-md px-2 py-0 rounded-full">
                                <IonText className='font-semibold text-xs text-neutral-600'>
                                    {formatDateHeader(dateKey)}
                                </IonText>
                            </div>

                            {index === 0 && (
                                <div className="ml-auto">
                                    <IonText className="albert-font font-semibold text-neutral-600">Session History</IonText>
                                </div>
                            )}
                        </div>

                        <div className='w-full flex flex-col gap-5'>
                            {items.map((item, index, array) => {
                                const isLast = index === array.length - 1;
                                return (
                                    <SessionItem
                                        key={item.id}
                                        item={item}
                                        user={user}
                                        isLast={isLast}
                                        workspaceId={workspaceId}
                                        onShowOptions={optionsHandler}
                                    />
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <IonInfiniteScroll
                disabled={isError || !hasMore}
                onIonInfinite={(event) => {
                    handleIonInfinite(event);
                    setTimeout(() => event.target.complete(), 500);
                }}
            >
                <IonInfiniteScrollContent></IonInfiniteScrollContent>
            </IonInfiniteScroll>
        </>
    )
}

export default LearnList;