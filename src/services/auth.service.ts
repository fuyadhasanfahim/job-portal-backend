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
import { createLog } from '../utils/logger.js';
import InvitationService from './invitation.service.js';

export async function signupService({
    firstName,
    lastName,
    email,
    phone,
    password,
    invitationToken,
}: Partial<IUser> & { invitationToken: string }) {
    if (!firstName || !email || !phone || !password || !invitationToken) {
        throw new Error(
            'Missing required fields: firstName, email, phone, password or invitationToken.',
        );
    }

    // Validate invitation token
    const validationResult =
        await InvitationService.validateInvitation(invitationToken);
    if (!validationResult.valid || !validationResult.invitation) {
        throw new Error(validationResult.error || 'INVALID_INVITATION');
    }

    const invitation = validationResult.invitation;

    // Check if the email matches the invitation
    if (invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error('EMAIL_MISMATCH');
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

    // Role comes from invitation, not user input
    const newUser = await UserModel.create({
        firstName: firstName.trim(),
        lastName: lastName?.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: invitation.role,
        password: hashedPassword,
    });

    // Mark invitation as used
    await InvitationService.markInvitationUsed(
        invitationToken,
        newUser._id.toString(),
    );

    await createLog({
        userId: newUser._id.toString(),
        action: 'user_signup',
        entityType: 'user',
        entityId: newUser._id as string,
        description: `${newUser.email} signed up with role "${newUser.role}" via invitation.`,
    });

    return newUser;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

export async function signinService(
    email: string,
    password: string,
    meta: { userAgent?: string; ip?: string },
) {
    const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new Error('INVALID_CREDENTIALS');

    // Check if account is locked (admins can always login)
    const isAdmin = user.role === 'admin' || user.role === 'super-admin';
    if (!isAdmin && user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil(
            (user.lockUntil.getTime() - Date.now()) / 60000,
        );
        throw new Error(`ACCOUNT_LOCKED:${remainingMinutes}`);
    }

    const isMatch = await compare(password, user.password);

    if (!isMatch) {
        // Increment failed attempts
        const failedAttempts = (user.failedLoginAttempts || 0) + 1;
        const updateData: { failedLoginAttempts: number; lockUntil?: Date } = {
            failedLoginAttempts: failedAttempts,
        };

        // Lock account if max attempts reached
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            updateData.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
            await UserModel.updateOne({ _id: user._id }, { $set: updateData });
            throw new Error('ACCOUNT_LOCKED:15');
        }

        await UserModel.updateOne({ _id: user._id }, { $set: updateData });
        throw new Error(
            `INVALID_CREDENTIALS:${MAX_FAILED_ATTEMPTS - failedAttempts}`,
        );
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
        await UserModel.updateOne(
            { _id: user._id },
            { $set: { failedLoginAttempts: 0, lockUntil: null } },
        );
    }

    const jti = newJti();
    const access = signAccessToken(String(user._id), String(user.role), jti);
    const refresh = signRefreshToken(String(user._id), String(user.role), jti);

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

    await createLog({
        userId: user._id.toString(),
        action: 'user_login',
        entityType: 'user',
        entityId: user._id as string,
        description: `${user.email} logged in successfully.`,
        ip: meta.ip ?? '',
        userAgent: meta.userAgent ?? '',
    });

    return { access, refresh, user };
}

// Admin function to unlock a user account
export async function unlockUserAccount(userId: string, adminId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    await UserModel.updateOne(
        { _id: userId },
        { $set: { failedLoginAttempts: 0, lockUntil: null } },
    );

    await createLog({
        userId: adminId,
        action: 'account_unlocked',
        entityType: 'user',
        entityId: userId,
        description: `Admin unlocked account for ${user.email}`,
    });

    return { success: true, message: 'Account unlocked successfully' };
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

    const user = await UserModel.findById(payload.sub).lean();
    if (!user) throw new Error('USER_NOT_FOUND');

    const nextJti = newJti();
    const newAccess = signAccessToken(payload.sub, user.role, nextJti);
    const newRefresh = signRefreshToken(payload.sub, user.role, nextJti);
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

    await createLog({
        userId: payload.sub,
        action: 'token_rotated',
        entityType: 'system',
        entityId: stored._id.toString(),
        description: `Refresh token rotated for user ${payload.sub}`,
        ip: meta.ip ?? '',
        ...(meta.userAgent && { userAgent: meta.userAgent }),
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

    await createLog({
        userId: payload.sub,
        action: 'token_revoked',
        entityType: 'system',
        description: `Refresh token revoked for user ${payload.sub} (jti: ${payload.jti})`,
    });
}
