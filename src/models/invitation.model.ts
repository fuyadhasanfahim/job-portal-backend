import { Schema, model } from 'mongoose';
import type { IInvitation } from '../types/invitation.interface.js';

const InvitationSchema = new Schema<IInvitation>(
    {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        role: {
            type: String,
            required: true,
            enum: [
                'super-admin',
                'admin',
                'telemarketer',
                'digital-marketer',
                'seo-executive',
                'social-media-executive',
                'web-developer',
                'photo-editor',
                'graphic-designer',
            ],
        },
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'used', 'expired', 'revoked'],
            default: 'pending',
        },
        usedAt: {
            type: Date,
        },
        usedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true },
);

// Index for faster lookups
InvitationSchema.index({ email: 1 });
InvitationSchema.index({ status: 1 });
InvitationSchema.index({ expiresAt: 1 });

const InvitationModel = model<IInvitation>('Invitation', InvitationSchema);
export default InvitationModel;
