import crypto from 'crypto';
import InvitationModel from '../models/invitation.model.js';
import UserModel from '../models/user.model.js';
import type { IInvitation } from '../types/invitation.interface.js';
import { createLog } from '../utils/logger.js';
import { Types } from 'mongoose';
import NotificationService from './notification.service.js';

// Generate a secure random token
function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

// Create a new invitation
async function createInvitation(
    email: string,
    role: string,
    invitedById: string,
    expiresInDays: number = 7,
): Promise<IInvitation> {
    // Check if user already exists
    const existingUser = await UserModel.findOne({
        email: email.toLowerCase().trim(),
    }).lean();
    if (existingUser) {
        throw new Error('USER_ALREADY_EXISTS');
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await InvitationModel.findOne({
        email: email.toLowerCase().trim(),
        status: 'pending',
        expiresAt: { $gt: new Date() },
    }).lean();

    if (existingInvitation) {
        throw new Error('INVITATION_ALREADY_EXISTS');
    }

    // Get inviter info for logging
    const inviter = await UserModel.findById(invitedById).lean();
    if (!inviter) {
        throw new Error('INVITER_NOT_FOUND');
    }

    // Only admins can invite
    if (inviter.role !== 'admin' && inviter.role !== 'super-admin') {
        throw new Error('UNAUTHORIZED_TO_INVITE');
    }

    // Super-admin role can only be invited by super-admin
    if (role === 'super-admin' && inviter.role !== 'super-admin') {
        throw new Error('ONLY_SUPERADMIN_CAN_INVITE_SUPERADMIN');
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invitation = await InvitationModel.create({
        email: email.toLowerCase().trim(),
        role,
        token,
        expiresAt,
        invitedBy: new Types.ObjectId(invitedById),
        status: 'pending',
    });

    await createLog({
        userId: invitedById,
        action: 'invitation_created',
        entityType: 'invitation',
        entityId: invitation._id as string,
        description: `Invited ${email} with role "${role}"`,
    });

    return invitation;
}

// Validate an invitation token
async function validateInvitation(token: string): Promise<{
    valid: boolean;
    invitation?: IInvitation;
    error?: string;
}> {
    const invitation = await InvitationModel.findOne({ token }).lean();

    if (!invitation) {
        return { valid: false, error: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.status === 'used') {
        return { valid: false, error: 'INVITATION_ALREADY_USED' };
    }

    if (invitation.status === 'revoked') {
        return { valid: false, error: 'INVITATION_REVOKED' };
    }

    if (new Date() > new Date(invitation.expiresAt)) {
        // Mark as expired
        await InvitationModel.updateOne(
            { _id: invitation._id },
            { status: 'expired' },
        );
        return { valid: false, error: 'INVITATION_EXPIRED' };
    }

    return { valid: true, invitation };
}

// Mark invitation as used after signup
async function markInvitationUsed(
    token: string,
    userId: string,
): Promise<void> {
    const invitation = await InvitationModel.findOne({ token });

    if (invitation) {
        invitation.status = 'used';
        invitation.usedAt = new Date();
        invitation.usedBy = new Types.ObjectId(userId);
        await invitation.save();

        // Get the new user's name for the notification
        const newUser = await UserModel.findById(userId).lean();
        const userName = newUser
            ? `${newUser.firstName} ${newUser.lastName}`.trim() || newUser.email
            : 'A new user';

        // Notify the inviter that the user has joined
        if (invitation.invitedBy) {
            await NotificationService.createNotification({
                recipientId: invitation.invitedBy.toString(),
                type: 'invitation_accepted',
                title: 'Invitation Accepted',
                message: `${userName} has joined using your invitation!`,
                data: {
                    userId: userId,
                    userName: userName,
                    invitationId: invitation._id as unknown as string,
                    link: '/invitations',
                },
            });
        }
    }
}

// Get all invitations (for admin panel)
async function getAllInvitations(invitedById?: string): Promise<IInvitation[]> {
    const query = invitedById
        ? { invitedBy: new Types.ObjectId(invitedById) }
        : {};
    return InvitationModel.find(query)
        .populate('invitedBy', 'firstName lastName email')
        .populate('usedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();
}

// Revoke an invitation
async function revokeInvitation(
    invitationId: string,
    revokedById: string,
): Promise<void> {
    const invitation = await InvitationModel.findById(invitationId);
    if (!invitation) {
        throw new Error('INVITATION_NOT_FOUND');
    }

    if (invitation.status !== 'pending') {
        throw new Error('CANNOT_REVOKE_USED_INVITATION');
    }

    invitation.status = 'revoked';
    await invitation.save();

    await createLog({
        userId: revokedById,
        action: 'invitation_revoked',
        entityType: 'invitation',
        entityId: invitationId,
        description: `Revoked invitation for ${invitation.email}`,
    });
}

// Resend invitation (generate new token)
async function resendInvitation(
    invitationId: string,
    resendById: string,
): Promise<IInvitation> {
    const invitation = await InvitationModel.findById(invitationId);
    if (!invitation) {
        throw new Error('INVITATION_NOT_FOUND');
    }

    if (invitation.status === 'used') {
        throw new Error('INVITATION_ALREADY_USED');
    }

    // Generate new token and extend expiry
    invitation.token = generateToken();
    invitation.expiresAt = new Date();
    invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
    invitation.status = 'pending';
    await invitation.save();

    await createLog({
        userId: resendById,
        action: 'invitation_resent',
        entityType: 'invitation',
        entityId: invitationId,
        description: `Resent invitation for ${invitation.email}`,
    });

    return invitation;
}

const InvitationService = {
    createInvitation,
    validateInvitation,
    markInvitationUsed,
    getAllInvitations,
    revokeInvitation,
    resendInvitation,
};

export default InvitationService;
