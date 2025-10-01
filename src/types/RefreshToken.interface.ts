import type { Types } from "mongoose";

export interface IRefreshToken {
    userId: Types.ObjectId;
    jti: string;
    tokenHash: string;
    userAgent?: string;
    ip?: string;
    revoked: boolean;
    replacedBy?: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
