import { Schema, model } from 'mongoose';
import type { INotification } from '../types/notification.interface.js';

const notificationSchema = new Schema<INotification>(
    {
        recipient: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['invitation_accepted', 'task_assigned', 'task_completed'],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        data: {
            userId: String,
            userName: String,
            taskId: String,
            taskTitle: String,
            invitationId: String,
            link: String,
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    },
);

// Compound index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

const NotificationModel = model<INotification>(
    'Notification',
    notificationSchema,
);

export default NotificationModel;
