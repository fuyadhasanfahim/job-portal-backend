import type { Types } from 'mongoose';

export type InvitationStatus = 'pending' | 'used' | 'expired' | 'revoked';

export interface IInvitation {
    _id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    invitedBy: Types.ObjectId;
    status: InvitationStatus;
    usedAt?: Date;
    usedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
