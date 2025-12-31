import { Types } from 'mongoose';

export type NotificationType =
    | 'invitation_accepted'
    | 'task_assigned'
    | 'task_completed';

export interface INotification {
    _id?: Types.ObjectId;
    recipient: Types.ObjectId; // User who receives the notification
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
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}
