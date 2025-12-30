import { type Request, type Response } from 'express';
import InvitationService from '../services/invitation.service.js';

async function createInvitation(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { email, role } = req.body as { email: string; role: string };

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Only admins can invite
        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can send invitations',
            });
        }

        if (!email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email and role are required',
            });
        }

        const invitation = await InvitationService.createInvitation(
            email,
            role,
            userId,
        );

        return res.status(201).json({
            success: true,
            message: 'Invitation created successfully',
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                role: invitation.role,
                token: invitation.token,
                expiresAt: invitation.expiresAt,
                status: invitation.status,
            },
        });
    } catch (error) {
        const message = (error as Error).message;

        if (message === 'USER_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists',
            });
        }

        if (message === 'INVITATION_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                message: 'A pending invitation for this email already exists',
            });
        }

        if (message === 'ONLY_SUPERADMIN_CAN_INVITE_SUPERADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Only super-admins can invite super-admins',
            });
        }

        console.error('Error creating invitation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create invitation',
        });
    }
}

async function validateInvitation(req: Request, res: Response) {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required',
            });
        }

        const result = await InvitationService.validateInvitation(token);

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.error,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Invitation is valid',
            invitation: {
                email: result.invitation?.email,
                role: result.invitation?.role,
                expiresAt: result.invitation?.expiresAt,
            },
        });
    } catch (error) {
        console.error('Error validating invitation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to validate invitation',
        });
    }
}

async function getAllInvitations(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view invitations',
            });
        }

        const invitations = await InvitationService.getAllInvitations();

        return res.status(200).json({
            success: true,
            invitations,
        });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch invitations',
        });
    }
}

async function revokeInvitation(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can revoke invitations',
            });
        }

        await InvitationService.revokeInvitation(id, userId);

        return res.status(200).json({
            success: true,
            message: 'Invitation revoked successfully',
        });
    } catch (error) {
        const message = (error as Error).message;

        if (message === 'INVITATION_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                message: 'Invitation not found',
            });
        }

        if (message === 'CANNOT_REVOKE_USED_INVITATION') {
            return res.status(400).json({
                success: false,
                message:
                    'Cannot revoke an invitation that has already been used',
            });
        }

        console.error('Error revoking invitation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to revoke invitation',
        });
    }
}

async function resendInvitation(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can resend invitations',
            });
        }

        const invitation = await InvitationService.resendInvitation(id, userId);

        return res.status(200).json({
            success: true,
            message: 'Invitation resent successfully',
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                token: invitation.token,
                expiresAt: invitation.expiresAt,
            },
        });
    } catch (error) {
        const message = (error as Error).message;

        if (message === 'INVITATION_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                message: 'Invitation not found',
            });
        }

        if (message === 'INVITATION_ALREADY_USED') {
            return res.status(400).json({
                success: false,
                message:
                    'Cannot resend an invitation that has already been used',
            });
        }

        console.error('Error resending invitation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend invitation',
        });
    }
}

const InvitationController = {
    createInvitation,
    validateInvitation,
    getAllInvitations,
    revokeInvitation,
    resendInvitation,
};

export default InvitationController;
