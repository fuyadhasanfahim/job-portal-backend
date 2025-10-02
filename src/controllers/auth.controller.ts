import type { Request, Response } from 'express';
import {
    revokeRefreshToken,
    rotateRefreshToken,
    signinService,
    signupService,
} from '../services/auth.service.js';
import {
    clearCsrfCookie,
    clearRefreshCookie,
    REFRESH_COOKIE_NAME,
    setCsrfCookie,
    setRefreshCookie,
} from '../utils/cookies.js';
import ms, { type StringValue } from 'ms';
import { env } from 'process';
import crypto from 'crypto';

const refreshMs = ms(env.refresh_expires as StringValue);

export async function signupController(req: Request, res: Response) {
    try {
        const { firstName, lastName, email, phone, role, password } = req.body;

        if (!firstName || !email || !phone || !password || !role) {
            return res
                .status(400)
                .json({ success: false, message: 'Missing required fields.' });
        }

        await signupService({
            firstName,
            lastName,
            email,
            phone,
            role,
            password,
        });

        return res
            .status(201)
            .json({ success: true, message: 'Account created successfully.' });
    } catch (error) {
        console.log(error);
        if ((error as Error).message === 'EMAIL_EXISTS') {
            return res
                .status(409)
                .json({ success: false, message: 'Email already registered.' });
        }

        return res
            .status(500)
            .json({ success: false, message: 'Failed to register user.' });
    }
}

export async function signinController(req: Request, res: Response) {
    try {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required.',
            });
        }

        const { access, refresh, user } = await signinService(email, password, {
            userAgent: req.get('user-agent') as string,
            ip: req.ip as string,
        });

        setRefreshCookie(res, refresh, refreshMs);

        const csrf = crypto.randomBytes(16).toString('hex');
        setCsrfCookie(res, csrf, refreshMs);

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            accessToken: access,
            user: {
                id: user._id,
                role: user.role,
            },
        });
    } catch (error) {
        if ((error as Error).message === 'INVALID_CREDENTIALS') {
            return res
                .status(401)
                .json({ success: false, message: 'Invalid credentials.' });
        }
        return res
            .status(500)
            .json({ success: false, message: 'Failed to log in.' });
    }
}

export async function refreshTokenController(req: Request, res: Response) {
    const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshCookie) {
        return res
            .status(401)
            .json({ success: false, message: 'No refresh token provided.' });
    }

    try {
        const { newAccess, newRefresh } = await rotateRefreshToken(
            refreshCookie,
            {
                userAgent: req.get('user-agent') as string,
                ip: req.ip as string,
            },
        );

        setRefreshCookie(res, newRefresh, refreshMs);

        const csrf = crypto.randomBytes(16).toString('hex');
        setCsrfCookie(res, csrf, refreshMs);

        return res.status(200).json({ success: true, accessToken: newAccess });
    } catch (error) {
        clearRefreshCookie(res);
        clearCsrfCookie(res);
        return res.status(401).json({
            success: false,
            message: (error as Error).message || 'Invalid session.',
        });
    }
}

export async function signoutController(req: Request, res: Response) {
    const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshCookie) {
        await revokeRefreshToken(refreshCookie);
    }

    clearRefreshCookie(res);
    clearCsrfCookie(res);

    return res
        .status(200)
        .json({ success: true, message: 'Signed out successfully.' });
}
