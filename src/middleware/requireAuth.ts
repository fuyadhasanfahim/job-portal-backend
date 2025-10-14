import type { Request, Response, NextFunction } from 'express';
import { verifyAccess, verifyRefresh, signAccessToken } from '../utils/jwt.js';
import RefreshTokenModel from '../models/RefreshToken.model.js';
import { verifyTokenHash } from '../utils/hash.js';
import { newJti } from '../utils/jwt.js';

declare module 'express' {
    interface Request {
        auth?: { id: string; role: string; jti: string };
        newAccessToken?: string;
    }
}

export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const header = req.headers.authorization;
    const refreshHeader = req.headers['x-refresh-token'] as string | undefined;

    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: No token provided',
        });
    }

    const token = header.slice('Bearer '.length).trim();

    try {
        const payload = verifyAccess(token);
        req.auth = { id: payload.sub, role: payload.role, jti: payload.jti };
        return next();
    } catch (error) {
        if ((error as Error).name === 'TokenExpiredError' && refreshHeader) {
            try {
                const refreshPayload = verifyRefresh(refreshHeader) as {
                    sub: string;
                    jti: string;
                    role: string;
                };

                const stored = await RefreshTokenModel.findOne({
                    jti: refreshPayload.jti,
                    userId: refreshPayload.sub,
                    revoked: false,
                });

                if (!stored) {
                    return res
                        .status(401)
                        .json({ success: false, message: 'Session expired' });
                }

                const valid = await verifyTokenHash(
                    refreshHeader,
                    stored.tokenHash,
                );
                if (!valid) {
                    await RefreshTokenModel.updateMany(
                        { userId: refreshPayload.sub },
                        { $set: { revoked: true } },
                    );
                    return res.status(401).json({
                        success: false,
                        message: 'Refresh token reuse detected',
                    });
                }

                const newJtiValue = newJti();
                const newAccessToken = signAccessToken(
                    refreshPayload.sub,
                    refreshPayload.role,
                    newJtiValue,
                );

                req.newAccessToken = newAccessToken;
                req.auth = {
                    id: refreshPayload.sub,
                    role: refreshPayload.role,
                    jti: newJtiValue,
                };
                res.setHeader('x-access-token', newAccessToken);

                return next();
            } catch (refreshErr) {
                console.error('Refresh token error:', refreshErr);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired refresh token',
                });
            }
        }

        return res
            .status(401)
            .json({ success: false, message: 'Invalid or expired token' });
    }
}
