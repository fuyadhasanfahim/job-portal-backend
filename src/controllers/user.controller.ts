import type { Request, Response } from 'express';
import {
    getAllUsersFromDB,
    getSignedUserFromDB,
    updatePasswordInDB,
    updateUserInDB,
} from '../services/user.service.js';

export async function getSignedUser(req: Request, res: Response) {
    try {
        const id = req.auth?.id;

        if (!id) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const user = await getSignedUserFromDB(id);

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ success: false, message: 'Failed to fetch user', error });
    }
}

export async function getUsers(req: Request, res: Response) {
    try {
        const { role, includeAdmins } = req.query as Record<
            string,
            string | boolean
        >;

        const requestedRole = req.auth?.role;

        if (requestedRole !== 'admin' && requestedRole !== 'super-admin') {
            return res
                .status(403)
                .json({ success: false, message: 'Forbidden' });
        }

        const users = await getAllUsersFromDB({
            role: role as string,
            includeAdmins: includeAdmins as boolean,
        });

        return res.status(200).json({
            success: true,
            users,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ success: false, message: 'Failed to fetch users', error });
    }
}

export async function updateUser(req: Request, res: Response) {
    try {
        const id = req.auth?.id;
        const data = req.body;

        if (!id) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const user = await updateUserInDB(id, data);

        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Info updated successfully',
            user,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ success: false, message: 'Failed to update user', error });
    }
}

export async function updatePassword(req: Request, res: Response) {
    try {
        const id = req.auth?.id;
        const { newPassword, oldPassword } = req.body;

        if (!id) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const user = await updatePasswordInDB(id, newPassword, oldPassword);

        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update password',
            error,
        });
    }
}
