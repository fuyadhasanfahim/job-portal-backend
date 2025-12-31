import { Types } from 'mongoose';
import NotificationModel from '../models/notification.model.js';
import type { NotificationType } from '../types/notification.interface.js';

interface CreateNotificationParams {
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: {
        userId?: string;
        userName?: string;
        taskId?: string;
        taskTitle?: string;
        invitationId?: string;
        link?: string;
    };
}

async function createNotification(params: CreateNotificationParams) {
    const { recipientId, type, title, message, data } = params;

    const notification = await NotificationModel.create({
        recipient: new Types.ObjectId(recipientId),
        type,
        title,
        message,
        data,
        read: false,
    });

    return notification;
}

async function getNotificationsForUser(
    userId: string,
    page: number = 1,
    limit: number = 20,
) {
    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    const [notifications, total, unreadCount] = await Promise.all([
        NotificationModel.find({ recipient: userObjectId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        NotificationModel.countDocuments({ recipient: userObjectId }),
        NotificationModel.countDocuments({
            recipient: userObjectId,
            read: false,
        }),
    ]);

    return {
        notifications,
        unreadCount,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
    };
}

async function getUnreadCount(userId: string) {
    const count = await NotificationModel.countDocuments({
        recipient: new Types.ObjectId(userId),
        read: false,
    });
    return count;
}

async function markAsRead(notificationId: string, userId: string) {
    const result = await NotificationModel.findOneAndUpdate(
        {
            _id: new Types.ObjectId(notificationId),
            recipient: new Types.ObjectId(userId),
        },
        { read: true },
        { new: true },
    );
    return result;
}

async function markAllAsRead(userId: string) {
    const result = await NotificationModel.updateMany(
        { recipient: new Types.ObjectId(userId), read: false },
        { read: true },
    );
    return result;
}

async function deleteNotification(notificationId: string, userId: string) {
    const result = await NotificationModel.findOneAndDelete({
        _id: new Types.ObjectId(notificationId),
        recipient: new Types.ObjectId(userId),
    });
    return result;
}

const NotificationService = {
    createNotification,
    getNotificationsForUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};

export default NotificationService;
