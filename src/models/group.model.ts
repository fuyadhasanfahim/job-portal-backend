import { Schema, model } from 'mongoose';
import type { IGroup } from '../types/group.interface.js';

const GroupSchema = new Schema<IGroup>(
    {
        name: { type: String, required: true, unique: true, trim: true },
        description: { type: String, trim: true },
        color: { type: String, default: '#6366f1' },
        isActive: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

const GroupModel = model<IGroup>('Group', GroupSchema);
export default GroupModel;
