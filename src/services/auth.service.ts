import { compare, hash } from 'bcryptjs';
import UserModel from '../models/user.model.js';
import type { IUser } from '../types/user.interface.js';
import env from '../config/env.js';
import {
    newJti,
    signAccessToken,
    signRefreshToken,
    verifyRefresh,
} from '../utils/jwt.js';
import { hashToken, verifyTokenHash } from '../utils/hash.js';
import RefreshTokenModel from '../models/RefreshToken.model.js';
import { addMs } from '../utils/time.js';

export async function signupService({
    firstName,
    lastName,
    email,
    phone,
    password,
}: Partial<IUser>) {
    if (!firstName || !email || !phone || !password) {
        throw new Error(
            'Missing required fields: firstName, email, phone, or password.',
        );
    }

    const isExistingUser = await UserModel.findOne({
        email: email.trim(),
    }).lean();

    if (isExistingUser) {
        const err = new Error('EMAIL_ALREADY_EXISTS');
        err.name = 'ConflictError';
        throw err;
    }

    const hashedPassword = await hash(password.trim(), 12);

    const newUser = await UserModel.create({
        firstName: firstName.trim(),
        lastName: lastName?.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: hashedPassword,
    });

    return newUser;
}

export async function signinService(
    email: string,
    password: string,
    meta: { userAgent?: string; ip?: string },
) {
    const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const isMatch = await compare(password, user.password);
    if (!isMatch) throw new Error('INVALID_CREDENTIALS');

    const jti = newJti();
    const access = signAccessToken(String(user._id), jti);
    const refresh = signRefreshToken(String(user._id), jti);

    const tokenHash = await hashToken(refresh);
    await RefreshTokenModel.create({
        userId: user._id,
        jti,
        tokenHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
        revoked: false,
        expiresAt: addMs(new Date(), env.refresh_expires),
    });

    return { access, refresh, user };
}

export async function rotateRefreshToken(
    refreshToken: string,
    meta: { userAgent?: string; ip?: string },
) {
    const payload = verifyRefresh(refreshToken) as {
        sub: string;
        jti: string;
        exp: number;
    };
    const stored = await RefreshTokenModel.findOne({
        jti: payload.jti,
        userId: payload.sub,
    });

    if (!stored) {
        await RefreshTokenModel.updateMany(
            { userId: payload.sub },
            { $set: { revoked: true } },
        );
        throw new Error('TOKEN_REUSE');
    }

    if (stored.revoked || stored.expiresAt.getTime() < Date.now()) {
        await RefreshTokenModel.deleteOne({ _id: stored._id });
        throw new Error('TOKEN_EXPIRED');
    }

    const isValid = await verifyTokenHash(refreshToken, stored.tokenHash);
    if (!isValid) {
        await RefreshTokenModel.updateMany(
            { userId: payload.sub },
            { $set: { revoked: true } },
        );
        throw new Error('TOKEN_REUSE');
    }

    const nextJti = newJti();
    const newAccess = signAccessToken(payload.sub, nextJti);
    const newRefresh = signRefreshToken(payload.sub, nextJti);
    const newHash = await hashToken(newRefresh);

    stored.revoked = true;
    stored.replacedBy = nextJti;
    await stored.save();

    await RefreshTokenModel.create({
        userId: stored.userId,
        jti: nextJti,
        tokenHash: newHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
        revoked: false,
        expiresAt: addMs(new Date(), env.refresh_expires),
    });

    return { newAccess, newRefresh };
}

export async function revokeRefreshToken(refreshToken: string) {
    const payload = verifyRefresh(refreshToken) as {
        sub: string;
        jti: string;
    };

    await RefreshTokenModel.updateMany(
        { userId: payload.sub, jti: payload.jti },
        { $set: { revoked: true } },
    );
}
