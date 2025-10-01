import ms from 'ms';

export function addMs(base: Date, duration: string): Date {
    const msValue = ms(duration as ms.StringValue);
    if (typeof msValue !== 'number') {
        throw new Error(`Invalid duration string: ${duration}`);
    }
    return new Date(base.getTime() + msValue);
}
