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

export interface IActivity {
    outcomeCode:
        | 'interestedInfo'
        | 'interestedQuotation'
        | 'noAnswer'
        | 'notInterestedNow'
        | 'invalidNumber'
        | 'existingClientFollowUp'
        | 'systemUpdate';

    nextAction?:
        | 'sendProposal'
        | 'followUp'
        | 'retry'
        | 'enrichContact'
        | 'scheduleMeeting'
        | 'closeLost';

    dueAt?: Date;
    notes?: string;
    lostReason?:
        | 'noBudget'
        | 'notInterested'
        | 'timing'
        | 'competitor'
        | 'other';
    attemptNumber?: number;
    durationSec?: number;
    contactedChannel?: 'phone' | 'sms' | 'whatsapp' | 'email';
    type: 'call' | 'email' | 'note' | 'statusChange';
    content?: string;
    statusFrom?: ILead['status'];
    statusTo?: ILead['status'];
    byUser: Types.ObjectId;
    at: Date;
    result?: string;
}

export interface ILead extends Document {
    company: ICompany;
    address?: string;
    country: string;
    notes?: string;

    contactPersons: IContactPerson[];

    status:
        | 'new'
        | 'contacted'
        | 'responded'
        | 'qualified'
        | 'meetingScheduled'
        | 'proposal'
        | 'won'
        | 'lost'
        | 'onHold'
        | 'archived';

    owner: Types.ObjectId;
    activities?: IActivity[];
}
