import type { Document, Types } from 'mongoose';

export interface IUser extends Document {
    firstName: string;
    lastName?: string;
    email: string;
    phone: string;
    image?: string;
    password: string;
    resetPasswordToken?: string;
    resetPasswordExpiry?: Date;

    role:
        | 'super-admin'
        | 'admin'
        | 'telemarketer'
        | 'digital-marketer'
        | 'seo-executive'
        | 'social-media-executive'
        | 'web-developer'
        | 'photo-editor'
        | 'graphic-designer';

    teamId?: Types.ObjectId;
    isActive: boolean;
    lastLogin?: Date;

    emailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpiry?: Date;
}
