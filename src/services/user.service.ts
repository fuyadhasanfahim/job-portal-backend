import { compare, hash } from 'bcryptjs';
import UserModel from '../models/user.model.js';
import type { IUser } from '../types/user.interface.js';
import type { FilterQuery } from 'mongoose';
import { createLog } from '../utils/logger.js';

export async function getSignedUserFromDB(id: string) {
    const user = await UserModel.findById(id).select('-password').lean();

    if (!user) {
        throw new Error('User not found');
    }

    return user;
}

export async function getAllUsersFromDB({
    role,
    includeAdmins = false,
}: {
    role: string;
    includeAdmins?: boolean;
}) {
    const query: FilterQuery<IUser> = {};

    if (role && role !== 'all-role') {
        query.role = role;
    }

    if (!includeAdmins) {
        query.role = query.role
            ? { $eq: query.role, $nin: ['admin', 'super-admin'] }
            : { $nin: ['admin', 'super-admin'] };
    }

    const users = await UserModel.find(query).select('-password').lean();

    return users;
}

export async function updateUserInDB(id: string, data: Partial<IUser>) {
    const userBefore = await UserModel.findById(id).lean();
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true })
        .select('-password')
        .lean();

    if (user) {
        await createLog({
            userId: id,
            action: 'update_user',
            entityType: 'user',
            entityId: id,
            description: `User ${user.email} profile updated.`,
            data: {
                before: userBefore,
                after: user,
            },
        });
    }

    return user;
}

export async function updatePasswordInDB(
    id: string,
    newPassword: string,
    oldPassword: string,
) {
    const user = await UserModel.findById(id);

    if (!user) {
        throw new Error('User not found');
    }

    const isMatch = await compare(oldPassword.trim(), user.password);

    if (!isMatch) {
        throw new Error('Old password is incorrect');
    }

    const hashedPassword = await hash(newPassword.trim(), 12);

    user.password = hashedPassword;
    await user.save();

    await createLog({
        userId: id,
        action: 'change_password',
        entityType: 'user',
        entityId: id,
        description: `User ${user.email} changed their password.`,
    });

    return user;
}
