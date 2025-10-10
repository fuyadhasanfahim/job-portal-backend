import type { Document, Types } from 'mongoose';

export interface ILead extends Document {
    companyName: string;
    websiteUrl?: string;
    emails: string[];
    phones: string[];
    address?: string;
    contactPerson: {
        firstName: string;
        lastName?: string;
    };
    designation?: string;
    country: string;
    status:
        | 'new'
        | 'contacted'
        | 'responded'
        | 'qualified'
        | 'meeting_scheduled'
        | 'proposal'
        | 'won'
        | 'lost'
        | 'on_hold';
    notes?: string;

    owner: Types.ObjectId;
    assignedBy?: Types.ObjectId;
    assignedAt?: Date;

    accessList: {
        user: Types.ObjectId;
        role: 'owner' | 'editor' | 'viewer';
        grantedBy: Types.ObjectId;
        grantedAt: Date;
    }[];

    activities: {
        type: 'call' | 'email' | 'note' | 'status_change';
        content: string;
        byUser: Types.ObjectId;
        at: Date;
        result?: string;
        nextActionAt?: Date;
    }[];
}

export type NewLead = Omit<
    ILead,
    '_id' | 'createdAt' | 'updatedAt' | keyof Document
> & {
    owner: Types.ObjectId;
    rowId?: string;
};

export type IncomingLead = {
    rowId?: string;
    companyName: string;
    websiteUrl?: string;
    emails?: string[];
    phones?: string[];
    address?: string;
    contactPerson: {
        firstName: string;
        lastName?: string;
    };
    designation?: string;
    country?: string;
    notes?: string;
};

export interface BulkCreateResult {
    inserted: number;
    updated: number;
    duplicates: number;
    errors: number;
    total: number;
}
