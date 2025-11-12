import {
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
} from 'date-fns';

export function getDateRange(
    period: 'today' | 'month' | 'year',
    monthParam?: string,
) {
    const now = new Date();

    if (monthParam && period === 'month') {
        const parts = monthParam.split('-');
        const year = Number(parts[0]);
        const month = parts[1] ? Number(parts[1]) : 1;

        if (isNaN(year) || isNaN(month)) {
            throw new Error(`Invalid monthParam format: ${monthParam}`);
        }

        const start = startOfMonth(new Date(year, month - 1));
        const end = endOfMonth(new Date(year, month - 1));
        return { start, end };
    }

    if (period === 'today') {
        return { start: startOfDay(now), end: endOfDay(now) };
    }

    if (period === 'month') {
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }

    if (period === 'year') {
        return { start: startOfYear(now), end: endOfYear(now) };
    }

    throw new Error('Invalid period');
}
