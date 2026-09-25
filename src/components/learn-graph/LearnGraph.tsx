import { IonText } from '@ionic/react';
import './LearnGraph.css';
import { format, intervalToDuration } from 'date-fns';
import { SessionDurationByDay } from '../../services/learning.session';

type Props = {
    days: SessionDurationByDay[];
}

type LearnGraphTypes = {
    durationSeconds: number;
    startedAt: string;
    notesCount: number;
}

const LearnGraph: React.FC<Props> = ({ days }) => {
    const wrapperHeight = 300;
    let learnSamples: LearnGraphTypes[] = [
        {
            durationSeconds: 4050,
            startedAt: '2026-01-01T09:00:00',
            notesCount: 1,
        },
        {
            durationSeconds: 3120,
            startedAt: '2026-01-03T14:15:00',
            notesCount: 3,
        },
        {
            durationSeconds: 0,
            startedAt: '2026-01-07T08:30:00',
            notesCount: 0,
        },
        {
            durationSeconds: 2460,
            startedAt: '2026-01-12T19:00:00',
            notesCount: 12,
        },
        {
            durationSeconds: 6540,
            startedAt: '2026-01-18T10:20:00',
            notesCount: 7,
        },
        {
            durationSeconds: 3780,
            startedAt: '2026-01-24T15:30:00',
            notesCount: 4,
        },
        {
            durationSeconds: 0,
            startedAt: '2026-01-30T20:00:00',
            notesCount: 0,
        },
    ];

    // update with days
    if (days.length > 0) {
        learnSamples = days.map(day => ({
            durationSeconds: day.duration_seconds_sum,
            startedAt: day.session_date,
            notesCount: day.pages_sum,
        }));
    }

    // Bar tertinggi (100%) = sample dengan durasi terpanjang.
    // Setiap bar lain dihitung sebagai persentase relatif terhadap durasi maksimum itu.
    const maxDurationSeconds = Math.max(...learnSamples.map(s => s.durationSeconds));

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    return (
        <div className="ion-padding-start ion-padding-end">
            <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                <div
                    className="flex gap-2 md:gap-7 justify-between"
                    style={{ height: `${wrapperHeight - 220}px` }}
                >
                    {learnSamples.map((item, index) => {
                        const percentage = (item.durationSeconds / maxDurationSeconds) * 100;
                        const duration = intervalToDuration({
                            start: 0,
                            end: (item.durationSeconds ?? 0) * 1000 // intervalToDuration expects milliseconds
                        });

                        // Kalikan hari dengan 24 dan tambahkan ke sisa jam
                        const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
                        const minutes = duration.minutes ?? 0;

                        return (
                            <div key={item.startedAt ?? index} className="flex flex-col items-center h-full w-12">
                                <div className="flex items-end flex-1 h-full w-full relative">
                                    <div
                                        className="absolute top-0 bottom-0 left-0 right-0 border border-dashed border-neutral-300 -mt-[32px] rounded-t-4xl"
                                        style={{ height: 'calc(100% + 32px)' }}
                                    />

                                    <div
                                        className={`w-full rounded-t-4xl relative ${item.durationSeconds > 60 ? 'bg-neutral-600' : 'bg-neutral-200'}`}
                                        style={{ height: `calc(${percentage}% + ${percentage > 0 ? '48px' : '32px'})` }}
                                    >
                                        <div className={`text-xs text-center pt-3 albert-font ${item.durationSeconds > 60 ? 'text-white' : 'text-neutral-600'}`}>
                                            {percentage.toFixed(0)}%
                                        </div>

                                        {item.durationSeconds > 60 && (
                                            <div className="text-[11px] flex flex-row flex-wrap gap-0.5 leading-3 justify-center items-center font-normal text-center text-white/80 oswald-font w-[85%] mx-auto">
                                                <IonText>{totalHours}h</IonText>
                                                <IonText>{minutes}m</IonText>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                <div
                    className="flex gap-2 md:gap-7 justify-between"
                    style={{ height: `${wrapperHeight - 220}px` }}
                >
                    {learnSamples.map((item, index) => {
                        return (
                            <div key={item.startedAt ?? index} className="flex flex-col items-center h-full w-12">
                                <div className='flex flex-col items-center justify-center w-full'>
                                    <div className={`pb-0.5 w-full oswald-font text-sm ion-text-center flex justify-center gap-0.5 rounded-b-lg ${item.durationSeconds > 60 ? 'bg-neutral-800' : 'bg-neutral-400'}`}>
                                        <IonText className='text-white font-normal'>
                                            {format(item.startedAt, 'cccccc')}
                                        </IonText>

                                        <IonText className='text-white font-semibold'>
                                            {format(item.startedAt, 'd')}
                                        </IonText>
                                    </div>

                                    <div className='pt-2 w-full'>
                                        <div className='aspect-square w-full bg-blue-100 shadow border border-neutral-50 rounded-full !rounded-b-lg flex flex-col items-center justify-center'>
                                            <IonText className='text-base font-semibold oswald-font leading-3 text-neutral-700 mt-2 mb-0.5'>
                                                {item.notesCount}
                                            </IonText>

                                            <IonText className='text-[10px] text-neutral-600 albert-font !font-normal'>
                                                {item.notesCount === 1 ? 'note' : 'notes'}
                                            </IonText>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default LearnGraph;