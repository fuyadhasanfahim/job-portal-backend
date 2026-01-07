import type { Document, Types } from 'mongoose';

export interface ICompany {
    name: string;
    website: string;
}

export interface IContactPerson {
    firstName?: string;
    lastName?: string;
    designation?: string;
    emails: string[];
    phones: string[];
}

export type LeadStatus =
    | 'all'
    | 'new'
    | 'answering-machine'
    | 'interested'
    | 'not-interested'
    | 'test-trial'
    | 'call-back'
    | 'language-barrier'
    | 'on-board'
    | 'invalid-number';

export type LeadSource = 'manual' | 'imported' | 'website';

export interface IImportBatch {
    batchId: string;
    importedAt: Date;
    importedBy: Types.ObjectId;
    fileName?: string | undefined;
    totalCount?: number;
}

export interface IActivity {
    status: LeadStatus;
    notes?: string;
    nextAction?:
        | 'follow-up'
        | 'send-proposal'
        | 'call-back'
        | 'close'
        | undefined;
    dueAt?: Date | undefined;
    byUser: Types.ObjectId;
    at: Date;
}

export interface ILead extends Document {
    company: ICompany;
    address?: string;
    country: string;
    notes?: string;

    contactPersons: IContactPerson[];
    status: LeadStatus;
    group?: Types.ObjectId | undefined;

    source: LeadSource;
    importBatch?: IImportBatch;

    owner: Types.ObjectId;
    activities?: IActivity[];
}
