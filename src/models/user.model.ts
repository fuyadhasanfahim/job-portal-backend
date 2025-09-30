import { model, Schema } from 'mongoose';
import type { IUser } from '../types/user.interface.js';

const userSchema = new Schema<IUser>(
    {
        firstName: {
            type: String,
            required: true,
        },
        lastName: String,
        email: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        image: {
            type: String,
            default: '',
        },

        password: {
            type: String,
            required: true,
        },
        resetPasswordToken: String,
        resetPasswordExpiry: Date,

        teamId: {
            type: Schema.Types.ObjectId,
            ref: 'team',
            required: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
            default: new Date(),
        },
    },
    {
        timestamps: true,
    },
);

const UserModel = model<IUser>('User', userSchema);
export default UserModel;
