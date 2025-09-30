import { hash } from 'bcryptjs';
import UserModel from '../models/user.model.js';
import type { IUser } from '../types/user.interface.js';

export async function createUserInDB({
    firstName,
    lastName,
    email,
    phone,
    password,
}: Partial<IUser>): Promise<IUser> {
    if (!firstName || !email || !phone || !password) {
        throw new Error(
            'Missing required fields: firstName, email, phone, or password.',
        );
    }

    const isExistingUser = await UserModel.findOne({
        email: email.trim(),
    }).lean();

    if (isExistingUser) {
        const err = new Error('EMAIL_ALREADY_EXISTS');
        err.name = 'ConflictError';
        throw err;
    }

    const hashedPassword = await hash(password.trim(), 12);

    const newUser = await UserModel.create({
        firstName: firstName.trim(),
        lastName: lastName?.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: hashedPassword,
    });

    return newUser;
}
