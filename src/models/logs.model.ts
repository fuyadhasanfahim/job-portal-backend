import { model, Schema } from 'mongoose';
import type { ILog } from '../types/logs.interface.js';

const logSchema = new Schema<ILog>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, required: true },
        entityType: {
            type: String,
            enum: ['lead', 'task', 'user', 'system', 'other'],
            required: true,
        },
        entityId: { type: Schema.Types.ObjectId },
        description: { type: String },
        data: { type: Object },
        ip: { type: String },
        userAgent: { type: String },
    },
    {
        timestamps: true,
    },
);

const LogModel = model<ILog>('Log', logSchema);
export default LogModel;
