import type { Request, Response, NextFunction } from 'express';

export function csrfGuard(req: Request, res: Response, next: NextFunction) {
    const cookie = req.cookies?.['csrf_token'];
    const header = req.headers['x-csrf-token'];
    if (!cookie || !header || cookie !== header) {
        return res
            .status(403)
            .json({ success: false, message: 'CSRF validation failed' });
    }
    next();
}
