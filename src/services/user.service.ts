import { compare, hash } from 'bcryptjs';
import UserModel from '../models/user.model.js';
import type { IUser } from '../types/user.interface.js';

export async function getSignedUserFromDB(id: string) {
    const user = await UserModel.findById(id).select('-password').lean();

    if (!user) {
        throw new Error('User not found');
    }

    return user;
}

export async function getAllUsersFromDB() {
    const users = await UserModel.find().select('-password').lean();
    return users;
}

export async function updateUserInDB(id: string, data: Partial<IUser>) {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true })
        .select('-password')
        .lean();

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

    return user;
}
