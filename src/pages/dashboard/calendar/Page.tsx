import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Page.css';
import FullCalendar, { useCalendarController } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import themePlugin from "@fullcalendar/react/themes/monarch";
import '@fullcalendar/react/themes/monarch/palettes/purple.css';
import '@fullcalendar/react/skeleton.css';
import { chevronBack, chevronForward } from 'ionicons/icons';
import { addDays, format, intervalToDuration } from 'date-fns';
import { useCurrentMonthRange } from '../../../hooks/useCurrentMonthRange';
import { useLazyGetSessionDurationSummaryQuery } from '../../../services/learning.session';
import { useCallback, useMemo, useRef, useState } from 'react';

// Abu-abu → hijau → orange → merah, versi soft (mirip alert background)
const COLOR_STOPS: [number, number, number][] = [
    [233, 236, 239], // abu-abu  #e9ecef
    [212, 237, 218], // hijau    #d4edda
    [255, 224, 178], // orange   #ffe0b2
    [248, 215, 218], // merah    #f8d7da
];

function getColorBySisaKamar(value: number, min: number, max: number): string {
    const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
    const segCount = COLOR_STOPS.length - 1;
    const seg = Math.min(segCount - 1, Math.floor(t * segCount));
    const segT = t * segCount - seg;

    const [r1, g1, b1] = COLOR_STOPS[seg];
    const [r2, g2, b2] = COLOR_STOPS[seg + 1];
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * segT);

    return `rgb(${lerp(r1, r2)}, ${lerp(g1, g2)}, ${lerp(b1, b2)})`;
}

const CalendarPage: React.FC = () => {
    const calendarRef = useRef(null);
    const controller = useCalendarController();
    const initialRange = useCurrentMonthRange();
    const [getSessions] = useLazyGetSessionDurationSummaryQuery();
    const [days, setDays] = useState<any[]>([]);
    const [statsRanged, setStatsRanged] = useState<{ total_durations: string, total_durations_ranged: string, total_sessions_ranged: number, total_pages: number }>({
        total_durations: '0.0',
        total_durations_ranged: '0.0',
        total_sessions_ranged: 0,
        total_pages: 0
    });

    const handleDatesSet = useCallback(async (arg: any) => {
        // view.currentStart & currentEnd = rentang bulan aktif (tanpa padding hari dari bulan sebelah)
        const startDate = format(arg.view.currentStart, 'yyyy-MM-dd');
        const endDate = format(addDays(arg.view.currentEnd, -1), 'yyyy-MM-dd');

        const { data: sessionData } = await getSessions({ timezone: initialRange.timezone, start_date: startDate, end_date: endDate });
        setDays(sessionData?.days ?? []);

        // set ranged stats
        if (sessionData) {
            const duration = intervalToDuration({
                start: 0,
                end: (sessionData.total_durations ?? 0) * 1000 // intervalToDuration expects milliseconds
            });

            // Kalikan hari dengan 24 dan tambahkan ke sisa jam
            const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
            const minutes = duration.minutes ?? 0;

            const durationRanged = intervalToDuration({
                start: 0,
                end: (sessionData.total_durations_ranged ?? 0) * 1000 // intervalToDuration expects milliseconds
            });

            // Kalikan hari dengan 24 dan tambahkan ke sisa jam
            const totalHoursRanged = (durationRanged.days ?? 0) * 24 + (durationRanged.hours ?? 0);
            const minutesRanged = durationRanged.minutes ?? 0;

            setStatsRanged({
                total_durations: `${totalHours}.${minutes}`,
                total_durations_ranged: `${totalHoursRanged}.${minutesRanged}`,
                total_sessions_ranged: sessionData.total_sessions_ranged,
                total_pages: sessionData.total_pages
            });
        }
    }, []);

    const styledEvents = useMemo(() => {
        // Jika data kosong, kembalikan array kosong langsung
        if (days.length === 0) return [];

        // 1. Map data awal & konversi detik ke jam (desimal)
        const events = days.map(day => {
            const duration = intervalToDuration({
                start: 0,
                end: (day?.duration_seconds_sum ?? 0) * 1000 // intervalToDuration expects milliseconds
            });

            // Kalikan hari dengan 24 dan tambahkan ke sisa jam
            const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
            const minutes = duration.minutes ?? 0;

            // --- LOGIKA DURASI ---
            let finalDuration = 0;

            if (totalHours >= 100) {
                // 1. Jika ratusan: sembunyikan menit
                finalDuration = totalHours;
            } else if (totalHours === 0) {
                // 2. Jika jam semuanya nol: tampilkan menit saja
                // (Misal: 31 menit -> hasilkan angka 31)
                finalDuration = minutes;

                // *Opsional: Jika maksudmu tetap ingin hasil '0.31', 
                // ganti baris di atas menjadi: finalDuration = parseFloat(`0.${minutes}`);
            } else {
                // 3. Jika puluhan/satuan: gabungkan jam dan menit
                finalDuration = parseFloat(`${totalHours}.${minutes}`);
            }

            return {
                title: 'Total Notes',
                start: day.session_date,
                extendedProps: {
                    totalNotes: day.pages_sum,
                    duration: finalDuration,
                    totalSeconds: day?.duration_seconds_sum ?? 0,
                },
            };
        });

        // 2. Cari Min dan Max
        const nilai = events.map(e => e.extendedProps.totalSeconds);
        const min = Math.min(...nilai);
        const max = Math.max(...nilai);

        // 3. Tambahkan warna berdasarkan gradien min/max
        return events.map(event => ({
            ...event,
            backgroundColor: getColorBySisaKamar(event.extendedProps.totalSeconds, min, max),
        }));
    }, [days]);

    return (
        <IonPage>
            <IonHeader className="ion-no-border" translucent>
                <IonToolbar className="borderless" color="light">
                    <IonButtons slot="start" className='ion-padding-start'>
                        <IonBackButton defaultHref='/dashboard' text={undefined} />
                    </IonButtons>

                    <IonTitle className="text-base absolute left-16 right-12 top-1 bottom-0 text-left">
                        {controller.view?.title}
                    </IonTitle>

                    <div slot='end' className='flex ml-auto gap-2 ion-padding-end'>
                        <div className='block'>
                            <IonButton
                                onClick={() => controller.prev()}
                                shape='round'
                                color='light'
                                size='small'
                                className='normal-button'
                                style={{
                                    'minHeight': '34px',
                                    'minWidth': '34px',
                                }}
                            >
                                <IonIcon icon={chevronBack} slot='icon-only' />
                            </IonButton>
                        </div>

                        <IonButton
                            shape='round'
                            onClick={() => controller.today()}
                            size='small'
                            color='light'
                            className='normal-button'
                            style={{
                                'height': '34px',
                            }}
                        >
                            <IonText className='normal-case tracker-normal'>Today</IonText>
                        </IonButton>

                        <div className='block'>
                            <IonButton
                                onClick={() => controller.next()}
                                shape='round'
                                color='light'
                                size='small'
                                className='normal-button'
                                style={{
                                    'minHeight': '34px',
                                    'minWidth': '34px',
                                }}
                            >
                                <IonIcon icon={chevronForward} slot='icon-only' />
                            </IonButton>
                        </div>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent color="light" className='ion-padding'>
                <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    {/* Ranged Stats */}

                    <div className="mb-4 flex gap-6">
                        <div className="text-left mb-2 flex flex-col">
                            <IonText className="!font-normal text-sm albert-font text-neutral-500">Studied times</IonText>
                            <div className='flex items-end'>
                                <IonText className="text-xl font-bold oswald-font text-neutral-600">{statsRanged.total_durations_ranged}</IonText>
                                <IonText className="text-md font-normal oswald-font text-neutral-500">h</IonText>
                            </div>
                        </div>

                        <div className="text-left mb-2 flex flex-col">
                            <IonText className="!font-normal text-sm albert-font text-neutral-500">Sessions</IonText>
                            <div className='flex items-end'>
                                <IonText className="text-xl font-bold oswald-font text-neutral-600">{statsRanged.total_sessions_ranged}</IonText>
                                <IonText className="text-md font-normal oswald-font text-neutral-500">total</IonText>
                            </div>
                        </div>

                        <div className="text-left mb-2 flex flex-col">
                            <IonText className="!font-normal text-sm albert-font text-neutral-500">Notes</IonText>
                            <div className='flex items-end'>
                                <IonText className="text-xl font-bold oswald-font text-neutral-600">{statsRanged.total_pages}</IonText>
                                <IonText className="text-md font-normal oswald-font text-neutral-500">pages</IonText>
                            </div>
                        </div>
                    </div>

                    <div className='block calendar-ui pt-2 sm:pt-6 lg:pt-14'>
                        <FullCalendar
                            ref={calendarRef}
                            controller={controller}
                            plugins={[themePlugin, dayGridPlugin]}
                            initialView="dayGridMonth"
                            events={styledEvents}
                            height={'auto'}
                            timeZone={'local'}
                            datesSet={handleDatesSet}
                            dayCellTopContent={(arg) => {
                                if (arg.isOther) {
                                    return <div style={{ visibility: 'hidden' }} />;
                                }

                                const day = format(arg.date, 'yyyy-MM-dd');
                                const event = styledEvents.find((d) => d.start === day);
                                const dayNumber = arg.date ? format(arg.date, 'd') : '';
                                const extProps = event?.extendedProps;

                                return (
                                    <div className="h-full pb-1.5">
                                        <div
                                            className="day-custom !rounded-b-lg !rounded-t-full flex flex-col items-between justify-center"
                                            style={{ backgroundColor: (extProps?.duration || arg.isPast) ? event?.backgroundColor : 'white' }}
                                        >
                                            <div className="flex justify-center pt-1 pb-1">
                                                <div className='w-4 h-4 sm:h-6 sm:w-6 shadow flex items-center justify-center rounded-full oswald-font text-[11px] sm:text-sm bg-white'>{dayNumber}</div>
                                            </div>

                                            <div className="oswald-font text-center flex items-center justify-center gap-0.5 pb-1 h-6 text-sm sm:text-base">
                                                {!arg.isFuture ? (
                                                    <>
                                                        <span>{extProps?.duration ?? 0}</span>
                                                        <span className="text-neutral-500">h</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className={`shadow-md ${arg.isFuture ? 'hazard-stripes' : 'bg-linear-to-t from-neutral-50 to-transparent'} rounded-xl h-8 flex items-center justify-center mt-2`}>
                                            {!arg.isFuture ? (
                                                <div className='block'>
                                                    <div className="flex items-center justify-center text-center w-full text-[11px] sm:text-sm lowercase !font-normal albert-font text-neutral-400 leading-3">
                                                        Notes
                                                    </div>
                                                    <div className="flex flex-row justify-center items-center w-full">
                                                        <span className="text-sm font-semibold block text-neutral-500 leading-3">
                                                            {extProps?.totalNotes ?? 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            }}
                            eventContent={(arg) => {
                                return null;
                            }}
                        />
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default CalendarPage;
