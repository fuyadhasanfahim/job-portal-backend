import type { Request, Response } from 'express';
import { getSignedUserService } from '../services/user.service.js';

export async function getSignedUserController(req: Request, res: Response) {
    try {
        const id = req.auth?.id;

        if (!id) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const user = await getSignedUserService(id);

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
