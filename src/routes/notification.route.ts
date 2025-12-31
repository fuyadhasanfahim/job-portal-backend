import { Router } from 'express';
import NotificationController from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// GET /notifications - Get all notifications for the user
router.get('/', requireAuth, NotificationController.getNotifications);

// GET /notifications/unread-count - Get count of unread notifications
router.get('/unread-count', requireAuth, NotificationController.getUnreadCount);

// PATCH /notifications/:notificationId/read - Mark single notification as read
router.patch(
    '/:notificationId/read',
    requireAuth,
    NotificationController.markAsRead,
);

// PATCH /notifications/mark-all-read - Mark all notifications as read
router.patch(
    '/mark-all-read',
    requireAuth,
    NotificationController.markAllAsRead,
);

// DELETE /notifications/:notificationId - Delete a notification
router.delete(
    '/:notificationId',
    requireAuth,
    NotificationController.deleteNotification,
);

export const notificationRoute = router;
