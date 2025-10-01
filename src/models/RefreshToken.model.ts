import mongoose, { Schema } from 'mongoose';
import type { IRefreshToken } from '../types/RefreshToken.interface.js';

const RefreshTokenSchema = new Schema<IRefreshToken>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            required: true,
        },
        jti: { type: String, index: true, required: true, unique: true },
        tokenHash: { type: String, required: true },
        userAgent: String,
        ip: String,
        revoked: { type: Boolean, default: false },
        replacedBy: String,
        expiresAt: { type: Date, required: true, index: true },
    },
    { timestamps: true },
);
const RefreshTokenModel = mongoose.model<IRefreshToken>(
    'RefreshToken',
    RefreshTokenSchema,
);

export default RefreshTokenModel;
