import type { Types } from 'mongoose';

export interface IUser {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    image: string;

    password: string;
    resetPasswordToken?: string;
    resetPasswordExpiry: Date;

    teamId: Types.ObjectId;

    isActive: boolean;
    lastLogin: Date;

    createdAt: Date;
    updatedAt: Date;
}
