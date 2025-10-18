import { Schema, model } from 'mongoose';
import type { ITask } from '../types/task.interface.js';

const TaskSchema = new Schema<ITask>(
    {
        title: { type: String, trim: true },
        description: { type: String, trim: true },

        type: {
            type: String,
            enum: ['lead_generation'],
            required: true,
        },

        quantity: { type: Number, default: 0 },
        leads: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Lead',
            },
        ],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        completedLeads: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Lead',
            },
        ],

        status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            default: 'pending',
        },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        progress: { type: Number, default: 0 },

        metrics: {
            done: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

TaskSchema.pre('save', function (next) {
    const task = this as ITask;

    const done = task.metrics?.done ?? 0;
    const total = task.metrics?.total ?? 0;

    task.progress =
        total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    if (total > 0 && done >= total && task.status !== 'completed') {
        task.status = 'completed';
        task.finishedAt = new Date();
    }

    next();
});

TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ status: 1 });

const TaskModel = model<ITask>('Task', TaskSchema);
export default TaskModel;
