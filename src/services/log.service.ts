import { Types } from 'mongoose';
import LeadModel from '../models/lead.model.js';
import UserModel from '../models/user.model.js';
import { getDateRange } from '../utils/getDateRange.js';

async function getLeadAnalyticsFromDB(monthFilter?: string) {
    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const { start: monthStart, end: monthEnd } = getDateRange(
        'month',
        monthFilter,
    );
    const { start: yearStart, end: yearEnd } = getDateRange('year');

    // --- Summary ---
    const [today, month, year, total] = await Promise.all([
        LeadModel.countDocuments({
            createdAt: { $gte: todayStart, $lte: todayEnd },
        }),
        LeadModel.countDocuments({
            createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
        LeadModel.countDocuments({
            createdAt: { $gte: yearStart, $lte: yearEnd },
        }),
        LeadModel.estimatedDocumentCount(),
    ]);

    // --- 1️⃣ Hourly stats (for the selected or current day) ---
    const hourly = await LeadModel.aggregate([
        {
            $match: {
                createdAt: { $gte: todayStart, $lte: todayEnd },
            },
        },
        {
            $group: {
                _id: { $hour: '$createdAt' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // --- 2️⃣ Daily stats (for a selected month or current month) ---
    const daily = await LeadModel.aggregate([
        {
            $match: {
                createdAt: { $gte: monthStart, $lte: monthEnd },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // --- 3️⃣ Monthly stats (for the last 12 months) ---
    const monthly = await LeadModel.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(
                        new Date().setFullYear(new Date().getFullYear() - 1),
                    ),
                },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // --- 4️⃣ Country breakdown ---
    const byCountry = await LeadModel.aggregate([
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    return {
        summary: { today, month, year, total },
        hourly: hourly.map((h) => ({ hour: h._id, count: h.count })),
        daily: daily.map((d) => ({ date: d._id, count: d.count })),
        monthly: monthly.map((m) => ({ month: m._id, count: m.count })),
        byCountry: byCountry.map((c) => ({ country: c._id, count: c.count })),
    };
}

async function getTopUsersFromDB({ page = 1, limit = 10, search = '' }) {
    const skip = (page - 1) * limit;
    const regex = new RegExp(search.trim(), 'i');

    const userIds = await LeadModel.distinct('owner');

    const query = {
        _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        ...(search && {
            $or: [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
                { role: regex },
            ],
        }),
    };

    const [users, total] = await Promise.all([
        UserModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'leads',
                    localField: '_id',
                    foreignField: 'owner',
                    as: 'leads',
                },
            },
            {
                $project: {
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    role: 1,
                    image: 1,
                    leadCount: { $size: '$leads' },
                },
            },
            { $sort: { leadCount: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]),
        UserModel.countDocuments(query),
    ]);

    return {
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
        users,
    };
}

// NEW: Get user lead statistics with filters
async function getUserLeadStatsFromDB(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
) {
    let dateStart: Date;
    let groupFormat: string;
    let groupBy;

    const now = new Date();

    switch (period) {
        case 'hourly':
            dateStart = new Date(now);
            dateStart.setHours(0, 0, 0, 0);
            groupBy = {
                hour: { $hour: '$createdAt' },
                userId: '$owner',
            };
            break;
        case 'daily':
            dateStart = new Date(now);
            dateStart.setDate(now.getDate() - 30);
            groupFormat = '%Y-%m-%d';
            groupBy = {
                date: {
                    $dateToString: { format: groupFormat, date: '$createdAt' },
                },
                userId: '$owner',
            };
            break;
        case 'weekly':
            dateStart = new Date(now);
            dateStart.setDate(now.getDate() - 90);
            groupBy = {
                week: { $week: '$createdAt' },
                year: { $year: '$createdAt' },
                userId: '$owner',
            };
            break;
        case 'monthly':
            dateStart = new Date(now);
            dateStart.setFullYear(now.getFullYear() - 1);
            groupFormat = '%Y-%m';
            groupBy = {
                month: {
                    $dateToString: { format: groupFormat, date: '$createdAt' },
                },
                userId: '$owner',
            };
            break;
    }

    const stats = await LeadModel.aggregate([
        {
            $match: {
                createdAt: { $gte: dateStart },
            },
        },
        {
            $group: {
                _id: groupBy,
                newCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] },
                },
                notNewCount: {
                    $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] },
                },
                totalCount: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id.userId',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $unwind: '$user',
        },
        {
            $project: {
                period: {
                    $switch: {
                        branches: [
                            {
                                case: { $gt: ['$_id.hour', null] },
                                then: '$_id.hour',
                            },
                            {
                                case: { $gt: ['$_id.date', null] },
                                then: '$_id.date',
                            },
                            {
                                case: { $gt: ['$_id.week', null] },
                                then: {
                                    $concat: [
                                        { $toString: '$_id.year' },
                                        '-W',
                                        { $toString: '$_id.week' },
                                    ],
                                },
                            },
                            {
                                case: { $gt: ['$_id.month', null] },
                                then: '$_id.month',
                            },
                        ],
                        default: 'unknown',
                    },
                },
                userId: '$user._id',
                userName: {
                    $concat: ['$user.firstName', ' ', '$user.lastName'],
                },
                userEmail: '$user.email',
                userRole: '$user.role',
                newCount: 1,
                notNewCount: 1,
                totalCount: 1,
            },
        },
        {
            $sort: { period: 1, totalCount: -1 },
        },
    ]);

    return stats;
}

// NEW: Get top users pie chart data
async function getTopUsersPieChartFromDB(
    period: 'hourly' | 'daily' | 'monthly' = 'daily',
    limit: number = 10,
) {
    let dateStart: Date;
    const now = new Date();

    switch (period) {
        case 'hourly':
            dateStart = new Date(now);
            dateStart.setHours(0, 0, 0, 0);
            break;
        case 'daily':
            dateStart = new Date(now);
            dateStart.setDate(now.getDate() - 30);
            break;
        case 'monthly':
            dateStart = new Date(now);
            dateStart.setFullYear(now.getFullYear() - 1);
            break;
    }

    const topUsers = await LeadModel.aggregate([
        {
            $match: {
                createdAt: { $gte: dateStart },
            },
        },
        {
            $group: {
                _id: '$owner',
                newCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] },
                },
                notNewCount: {
                    $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] },
                },
                totalCount: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $unwind: '$user',
        },
        {
            $project: {
                userId: '$user._id',
                userName: {
                    $concat: ['$user.firstName', ' ', '$user.lastName'],
                },
                userEmail: '$user.email',
                userRole: '$user.role',
                newCount: 1,
                notNewCount: 1,
                totalCount: 1,
            },
        },
        {
            $sort: { totalCount: -1 },
        },
        {
            $limit: limit,
        },
    ]);

    return topUsers;
}

// NEW: Get all users table data (excluding super-admin and admin)
async function getAllUsersTableFromDB({ page = 1, limit = 10, search = '' }) {
    const skip = (page - 1) * limit;
    const regex = new RegExp(search.trim(), 'i');

    const query: {
        role: { $nin: string[] };
        $or?: Array<{ [key: string]: RegExp }>;
    } = {
        role: { $nin: ['super-admin', 'admin', 'system'] },
    };

    if (search) {
        query.$or = [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
            { role: regex },
        ];
    }

    const [users, total] = await Promise.all([
        UserModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'leads',
                    localField: '_id',
                    foreignField: 'owner',
                    as: 'leads',
                },
            },
            {
                $project: {
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    role: 1,
                    image: 1,
                    totalLeads: { $size: '$leads' },
                    newLeads: {
                        $size: {
                            $filter: {
                                input: '$leads',
                                as: 'lead',
                                cond: { $eq: ['$$lead.status', 'new'] },
                            },
                        },
                    },
                    notNewLeads: {
                        $size: {
                            $filter: {
                                input: '$leads',
                                as: 'lead',
                                cond: { $ne: ['$$lead.status', 'new'] },
                            },
                        },
                    },
                },
            },
            { $sort: { totalLeads: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]),
        UserModel.countDocuments(query),
    ]);

    return {
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
        users,
    };
}

const LogServices = {
    getLeadAnalyticsFromDB,
    getTopUsersFromDB,
    getUserLeadStatsFromDB,
    getTopUsersPieChartFromDB,
    getAllUsersTableFromDB,
};

export default LogServices;
