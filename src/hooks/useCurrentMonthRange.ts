import { useMemo } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        // fallback jika API tidak tersedia atau gagal terdeteksi
        return 'Asia/Jakarta';
    }
}

export function useCurrentMonthRange() {
    return useMemo(() => {
        const timezone = getUserTimezone();
        const nowInTz = toZonedTime(new Date(), timezone);

        const start = startOfMonth(nowInTz);
        const end = endOfMonth(nowInTz);

        return {
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd'),
            timezone,
        };
    }, []);
}