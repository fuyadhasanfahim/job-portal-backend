import type { Request, Response } from 'express';
import NotificationService from '../services/notification.service.js';

async function getNotifications(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await NotificationService.getNotificationsForUser(
            userId,
            page,
            limit,
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
        });
    }
}

async function getUnreadCount(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const count = await NotificationService.getUnreadCount(userId);

        return res.status(200).json({
            success: true,
            count,
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch unread count',
        });
    }
}

async function markAsRead(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const { notificationId } = req.params;

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const notification = await NotificationService.markAsRead(
            notificationId || '',
            userId,
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            notification,
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
        });
    }
}

async function markAllAsRead(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        await NotificationService.markAllAsRead(userId);

        return res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        console.error('Error marking all as read:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark all as read',
        });
    }
}

async function deleteNotification(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const { notificationId } = req.params;

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const result = await NotificationService.deleteNotification(
            notificationId || '',
            userId,
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification deleted',
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
        });
    }
}

const NotificationController = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};

export default NotificationController;
