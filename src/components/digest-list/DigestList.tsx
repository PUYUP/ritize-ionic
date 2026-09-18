import { IonCard, IonCardContent, IonInfiniteScroll, IonInfiniteScrollContent, IonText, useIonRouter } from '@ionic/react';
import './DigestList.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DigestTypes, useGetDigestsQuery } from '../../services/digest';
import Swiper from 'swiper';
import { FreeMode, Mousewheel, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/pagination';

interface Props {
    workspaceId?: string;
}

// --- Grouping helpers (per-day, based on digest_datetime) ---

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** Extract the "YYYY-MM-DD" date key from digest_datetime, with no timezone conversion. */
const getDateKey = (isoString: string): string => isoString?.slice(0, 10);

/** "2026-09-05" -> "September 5, 2026" (safe from timezone shifts when parsing Date). */
const formatDateHeader = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
};

interface DigestGroup {
    dateKey: string;
    digests: DigestTypes[];
    onShowOptions?: (item: DigestTypes) => void;
    onRefreshPapers?: (item: DigestTypes) => void;
}

/**
 * Group digests by digest_datetime (per day).
 * The order of dates and digests within each group follows the original API order
 * (not re-sorted), to stay consistent with pagination/infinite scroll.
 */
const groupDigestsByDate = (digests: DigestTypes[]): DigestGroup[] => {
    const map = new Map<string, DigestTypes[]>();

    for (const digest of digests) {
        const key = getDateKey(digest.for_date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(digest);
    }

    return [...map.entries()].map(([dateKey, groupDigests]) => ({ dateKey, digests: groupDigests }));
};

const DigestItem: React.FC<{
    item: DigestTypes,
    isLast: boolean,
    workspaceId?: string,
}> = ({
    item,
    isLast,
    workspaceId,
}) => {
        const { content, category } = item;

        return (
            <IonCard className='rounded-xl h-full !shadow-none'>
                <IonCardContent className='ion-padding'>
                    <div className='block mb-3'>
                        <div className={`rounded-full px-1.5 py-1 leading-3 bg-purple-200 inline-block shadow text-purple-800`}>
                            <IonText>{category}</IonText>
                        </div>
                    </div>
                    <div className='block text-base text-neutral-700'>{content}</div>
                </IonCardContent>
            </IonCard>
        )
    }

const DigestItems: React.FC<{
    digests: DigestTypes[],
    date: string,
}> = ({
    digests,
    date,
}) => {
        const pagesSwiperElRef = useRef<HTMLDivElement>(null);
        const pagesSwiperRef = useRef<Swiper | null>(null);

        // Initialize the pages Swiper once and clean it up on unmount.
        useEffect(() => {
            const containerEl = pagesSwiperElRef.current;
            if (!containerEl) return;

            pagesSwiperRef.current = new Swiper(containerEl, {
                modules: [FreeMode, Mousewheel, Pagination],
                direction: 'horizontal',
                slidesPerView: 1,
                spaceBetween: 16,
                freeMode: false,
                mousewheel: {
                    forceToAxis: true,
                    releaseOnEdges: true,
                },
                resistanceRatio: 0,
                watchOverflow: true,
                observer: true,
                observeParents: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
            });

            return () => {
                pagesSwiperRef.current?.destroy(true, true);
                pagesSwiperRef.current = null;
            };
        }, []);

        return (
            <div className='h-full overflow-hidden digest-swiper'>
                <div ref={pagesSwiperElRef} className='swiper h-full relative'>
                    <div className='absolute top-4 right-4 left-0 z-50'>
                        <div className="swiper-pagination !static flex justify-end"></div>
                    </div>

                    <div id="pages-list" className='swiper-wrapper flex flex-row h-full'>
                        {digests.map((item, index, array) => {
                            const isLast = index === array.length - 1;
                            return (
                                <div key={item.id} className='swiper-slide h-full'>
                                    <DigestItem
                                        item={item}
                                        isLast={isLast}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

const DigestList: React.FC<Props> = ({ workspaceId }) => {
    const ionRouter = useIonRouter();
    const [ionScrollEl, setIonScrollEl] = useState<HTMLIonInfiniteScrollElement | null>(null);
    const [page, setPage] = useState(1);

    // RTK Query
    const { data, isLoading, isFetching, isSuccess, isError } = useGetDigestsQuery({
        workspace_id: workspaceId,
        page: page,
        pageSize: 20,
    });

    const groupedDigests = useMemo(() => groupDigestsByDate(data?.results ?? []), [data?.results]);
    const hasMore = (data?.results.length ?? 0) < (data?.count ?? 0);

    const handleIonInfinite = async (e: CustomEvent<void>) => {
        if (!isFetching && hasMore) {
            setPage((p) => p + 1);
            console.log("page: ", page);
        }

        setIonScrollEl(e.target as HTMLIonInfiniteScrollElement);
    };

    useEffect(() => {
        if (isSuccess && !isFetching) {
            ionScrollEl?.complete();
        }
    }, [isSuccess, isFetching]);

    if (isLoading && page === 1) {
        return (
            <div className="ion-padding text-center ion-padding">
                <IonText className='text-center ion-padding'>Loading...</IonText>
            </div>
        );
    }

    if (isError) return (
        <div className='flex items-center justify-center h-full ion-padding'>
            <IonText color="danger">Error loading digests</IonText>
        </div>
    );

    if (data?.results?.length === 0) return (
        <div className='flex items-center justify-center h-full ion-padding'>
            <IonText color="medium" className='ion-text-center'>
                Start your note first to get Digests by select input method: <br />
                Texting, Canvas, or File Upload.
            </IonText>
        </div>
    );

    if (isError) return (
        <div className='flex items-center justify-center h-full ion-padding'>
            <IonText color="danger">Error loading digests</IonText>
        </div>
    );

    return (
        <>
            <div id="digestlist" className='flex flex-col gap-4 digests-list'>
                <div className='grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4 xl:gap-5'>
                    {groupedDigests.map(({ dateKey, digests }) => (
                        <div key={dateKey} className='block flex flex-col w-full gap-4'>
                            <div className='block ion-padding-start -mb-2'>
                                <IonText className='font-semibold text-orange-600'>
                                    <h3 className="!text-lg !my-0">
                                        {formatDateHeader(dateKey)}
                                    </h3>
                                </IonText>
                            </div>

                            <DigestItems date={dateKey} digests={digests} />
                        </div>
                    ))}
                </div>
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

export default DigestList;