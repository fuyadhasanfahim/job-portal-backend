import type { Request, Response } from 'express';
import { createUserInDB } from '../services/user.service.js';

export async function createUser(req: Request, res: Response) {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        if (!firstName || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message:
                    'Please provide all required fields (first name, email, phone, and password).',
            });
        }

        const user = await createUserInDB({
            firstName,
            lastName,
            email,
            phone,
            password,
        });

        if (!user) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create user. Please try again later.',
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Account created successfully. Welcome aboard!',
        });
    } catch (error) {
        if ((error as Error).message.includes('already in use')) {
            return res.status(400).json({
                success: false,
                message:
                    'This email is already registered. Please log in instead.',
            });
        }

        return res.status(500).json({
            success: false,
            message:
                'Something went wrong while creating your account. Please try again later.',
            error,
        });
    }
}
