import type { Types } from 'mongoose';

export interface IGroup {
    _id: string;
    name: string;
    description?: string;
    color?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
