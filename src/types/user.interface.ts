export interface IUser {
    _id: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone: string;
    image: string;
    designation: string;
    address: string;
    country: string;
    bio: string;
    socialLinks?: {
        icon: string;
        username: string;
        url: string;
        platform: string;
        color: string;
    }[];
    createdAt: Date;
    updatedAt: Date;

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

    teamId?: string;
    isActive: boolean;
    lastLogin?: Date;

    emailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpiry?: Date;
}
