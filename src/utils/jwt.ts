import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';
import type { StringValue } from 'ms';

type JwtPayloadBase = { sub: string; jti: string };

export function newJti() {
    return crypto.randomUUID();
}

export function signAccessToken(userId: string, jti: string) {
    const options: SignOptions = {
        expiresIn: env.access_expires as StringValue | number,
    };
    return jwt.sign({ sub: userId, jti }, env.access_secret, options);
}

export function signRefreshToken(userId: string, jti: string) {
    const options: SignOptions = {
        expiresIn: env.refresh_expires as StringValue | number,
    };
    return jwt.sign({ sub: userId, jti }, env.refresh_secret, options);
}

export function verifyAccess(token: string) {
    return jwt.verify(token, env.access_secret) as JwtPayloadBase &
        jwt.JwtPayload;
}

export function verifyRefresh(token: string) {
    return jwt.verify(token, env.refresh_secret) as JwtPayloadBase &
        jwt.JwtPayload;
}
