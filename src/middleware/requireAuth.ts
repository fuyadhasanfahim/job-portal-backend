import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt.js';

declare module 'express' {
    interface Request {
        auth?: { id: string; jti: string };
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
        return res
            .status(401)
            .json({ success: false, message: 'Unauthorized' });
    }

    const token = header.slice('Bearer '.length).trim();
    
    try {
        const payload = verifyAccess(token);
        req.auth = { id: payload.sub, jti: payload.jti };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            error,
        });
    }
}
