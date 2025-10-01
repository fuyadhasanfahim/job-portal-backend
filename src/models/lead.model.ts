import mongoose, { Schema, Types } from 'mongoose';

const LeadSchema = new Schema(
    {
        companyName: String,
        websiteUrl: String,
        email: [String],
        address: String,
        contactPerson: {
            firstName: String,
            lastName: String,
        },
        designation: String,
        phone: [String],
        country: String,
        status: { type: String, default: 'new' },
        notes: String,

        owner: {
            type: Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true },
);

export interface ILead extends mongoose.Document {
    companyName: string;
    websiteUrl: string;
    email: string[];
    address: string;
    contactPerson: {
        firstName: string;
        lastName: string;
    };
    designation: string;
    phone: string[];
    country: string;
    status: string;
    notes: string;
    owner: Types.ObjectId;
}

const LeadModel = mongoose.model('Lead', LeadSchema);
export default LeadModel;
