// hooks/useCurrentWeekRange.ts
import { useMemo } from 'react';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        // fallback kalau API tidak tersedia (browser sangat lama) atau gagal terdeteksi
        return 'Asia/Jakarta';
    }
}

export function useCurrentWeekRange() {
    return useMemo(() => {
        const timezone = getUserTimezone();
        const nowInTz = toZonedTime(new Date(), timezone);

        const start = startOfWeek(nowInTz, { weekStartsOn: 1 }); // Senin
        const end = endOfWeek(nowInTz, { weekStartsOn: 1 }); // Minggu

        return {
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd'),
            timezone,
        };
    }, []);
}