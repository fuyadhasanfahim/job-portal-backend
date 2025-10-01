import UserModel from '../models/user.model.js';

export async function getSignedUserService(id: string) {
    const user = await UserModel.findById(id).select('-password').lean();

    if (!user) {
        throw new Error('User not found');
    }

    return user;
}
