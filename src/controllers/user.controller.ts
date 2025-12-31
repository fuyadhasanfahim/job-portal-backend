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
        const message = (error as Error).message;
        if (message === 'Old password is incorrect') {
            return res.status(400).json({ success: false, message });
        }
        if (message === 'PASSWORD_RECENTLY_USED') {
            return res.status(400).json({
                success: false,
                message:
                    'This password has been used recently. Please choose a different one.',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to update password',
            error,
        });
    }
}

// Admin endpoint to unlock a user account
export async function unlockUserAccountController(req: Request, res: Response) {
    try {
        const adminId = req.auth?.id;
        const adminRole = req.auth?.role;
        const { userId } = req.params;

        if (!adminId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        if (adminRole !== 'admin' && adminRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Admin access required',
            });
        }

        const { unlockUserAccount } = await import(
            '../services/auth.service.js'
        );
        const result = await unlockUserAccount(userId || '', adminId);

        return res.status(200).json(result);
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'USER_NOT_FOUND') {
            return res
                .status(404)
                .json({ success: false, message: 'User not found' });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to unlock account',
            error,
        });
    }
}
