import type { Response } from 'express';
import env from '../config/env.js';

const isProd = env.node_env === 'production';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const CSRF_COOKIE_NAME = 'csrf_token';

export function setRefreshCookie(
    res: Response,
    value: string,
    maxAgeMs: number,
) {
    res.cookie(REFRESH_COOKIE_NAME, value, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? env.cookie_domain : undefined,
        path: '/',
        maxAge: maxAgeMs,
    });
}

export function clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? env.cookie_domain : undefined,
        path: '/',
    });
}

export function setCsrfCookie(res: Response, value: string, maxAgeMs: number) {
    res.cookie(CSRF_COOKIE_NAME, value, {
        httpOnly: false,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? env.cookie_domain : undefined,
        path: '/',
        maxAge: maxAgeMs,
    });
}

export function clearCsrfCookie(res: Response) {
    res.clearCookie(CSRF_COOKIE_NAME, {
        httpOnly: false,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? env.cookie_domain : undefined,
        path: '/',
    });
}
