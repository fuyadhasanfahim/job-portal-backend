import { Schema, model } from 'mongoose';
import type { IUser } from '../types/user.interface.js';

const UserSchema = new Schema<IUser>(
    {
        firstName: { type: String, required: true },
        lastName: { type: String },
        email: { type: String, required: true, unique: true },
        phone: { type: String, required: true },
        image: { type: String, default: '' },
        designation: { type: String, default: '' },
        address: { type: String, default: '' },
        country: { type: String, default: '' },
        bio: { type: String, default: '' },
        socialLinks: [
            {
                icon: { type: String, required: true },
                username: { type: String, required: true },
                url: { type: String, required: true },
                platform: { type: String, required: true },
                color: { type: String, required: true },
            },
        ],

        password: { type: String, required: true },
        resetPasswordToken: { type: String },
        resetPasswordExpiry: { type: Date },

        role: {
            type: String,
            enum: [
                'super-admin',
                'admin',
                'team-leader',
                'telemarketer',
                'digital-marketer',
                'seo-executive',
                'social-media-executive',
                'web-developer',
                'photo-editor',
                'graphic-designer',
            ],
            required: true,
        },

        teamId: {
            type: Schema.Types.ObjectId,
            ref: 'Team',
        },

        isActive: { type: Boolean, default: true },
        lastLogin: { type: Date, default: Date.now },

        emailVerified: { type: Boolean, default: false },
        emailVerificationToken: { type: String },
        emailVerificationExpiry: { type: Date },

        // Account lockout fields
        failedLoginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },

        // Password history (stores last 5 password hashes)
        passwordHistory: [{ type: String }],
    },
    { timestamps: true },
);

const UserModel = model<IUser>('User', UserSchema);
export default UserModel;
