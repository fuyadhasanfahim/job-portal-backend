import { Types } from 'mongoose';
import LeadModel from '../models/lead.model.js';
import TaskModel from '../models/task.model.js';
import UserModel from '../models/user.model.js';
import LogModel from '../models/logs.model.js';

interface DateRange {
    startDate?: string | undefined;
    endDate?: string | undefined;
}

function getDateFilter(range: DateRange) {
    const filter: { $gte?: Date; $lte?: Date } = {};
    if (range.startDate) {
        filter.$gte = new Date(range.startDate);
    }
    if (range.endDate) {
        const end = new Date(range.endDate);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
    }
    return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
}

// KPI Overview Stats
async function getOverviewStats(range: DateRange = {}) {
    const dateFilter = getDateFilter(range);

    const [
        totalLeads,
        newLeadsToday,
        activeTasks,
        completedTasks,
        activeUsers,
        totalUsers,
        interestedLeads,
        onBoardLeads,
    ] = await Promise.all([
        LeadModel.countDocuments(dateFilter),
        LeadModel.countDocuments({
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
        }),
        TaskModel.countDocuments({ status: 'in_progress', ...dateFilter }),
        TaskModel.countDocuments({ status: 'completed', ...dateFilter }),
        UserModel.countDocuments({ isActive: true }),
        UserModel.countDocuments(),
        LeadModel.countDocuments({ status: 'interested', ...dateFilter }),
        LeadModel.countDocuments({ status: 'on-board', ...dateFilter }),
    ]);

    const conversionRate =
        totalLeads > 0
            ? Math.round((onBoardLeads / totalLeads) * 100 * 10) / 10
            : 0;

    return {
        totalLeads,
        newLeadsToday,
        activeTasks,
        completedTasks,
        activeUsers,
        totalUsers,
        interestedLeads,
        onBoardLeads,
        conversionRate,
    };
}

// Lead Status Distribution for Pie Chart
async function getLeadStatusDistribution(range: DateRange = {}) {
    const dateFilter = getDateFilter(range);

    const distribution = await LeadModel.aggregate([
        { $match: { status: { $ne: 'all' }, ...dateFilter } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const statusColors: Record<string, string> = {
        new: '#3b82f6',
        interested: '#22c55e',
        'not-interested': '#ef4444',
        'call-back': '#f59e0b',
        'on-board': '#10b981',
        'test-trial': '#8b5cf6',
        'answering-machine': '#6b7280',
        'language-barrier': '#f97316',
        'invalid-number': '#dc2626',
    };

    return distribution.map((d) => ({
        name: d._id,
        value: d.count,
        color: statusColors[d._id] || '#94a3b8',
    }));
}

// Lead Trends for Line Chart
async function getLeadTrends(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    range: DateRange = {},
) {
    let dateFormat: string;
    let daysBack: number;

    switch (period) {
        case 'weekly':
            dateFormat = '%Y-W%V';
            daysBack = 90;
            break;
        case 'monthly':
            dateFormat = '%Y-%m';
            daysBack = 365;
            break;
        default:
            dateFormat = '%Y-%m-%d';
            daysBack = 30;
    }

    const startDate = range.startDate
        ? new Date(range.startDate)
        : new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const endDate = range.endDate ? new Date(range.endDate) : new Date();

    const trends = await LeadModel.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: dateFormat, date: '$createdAt' },
                },
                count: { $sum: 1 },
                interested: {
                    $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] },
                },
                onBoard: {
                    $sum: { $cond: [{ $eq: ['$status', 'on-board'] }, 1, 0] },
                },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return trends.map((t) => ({
        date: t._id,
        leads: t.count,
        interested: t.interested,
        onBoard: t.onBoard,
    }));
}

// Task Performance Metrics
async function getTaskPerformance(range: DateRange = {}) {
    const dateFilter = getDateFilter(range);

    const [statusBreakdown, avgProgress] = await Promise.all([
        TaskModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        TaskModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, avgProgress: { $avg: '$progress' } } },
        ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusBreakdown.forEach((s) => {
        statusMap[s._id] = s.count;
    });

    return {
        pending: statusMap['pending'] || 0,
        inProgress: statusMap['in_progress'] || 0,
        completed: statusMap['completed'] || 0,
        cancelled: statusMap['cancelled'] || 0,
        averageProgress: Math.round(avgProgress[0]?.avgProgress || 0),
    };
}

// User Performance Rankings
async function getUserPerformance(range: DateRange = {}, limit = 10) {
    const dateFilter = getDateFilter(range);

    const performance = await LeadModel.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: '$owner',
                totalLeads: { $sum: 1 },
                interested: {
                    $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] },
                },
                onBoard: {
                    $sum: { $cond: [{ $eq: ['$status', 'on-board'] }, 1, 0] },
                },
            },
        },
        { $sort: { totalLeads: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user',
            },
        },
        { $unwind: '$user' },
        {
            $project: {
                _id: 1,
                totalLeads: 1,
                interested: 1,
                onBoard: 1,
                name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
                email: '$user.email',
                role: '$user.role',
                image: '$user.image',
            },
        },
    ]);

    return performance;
}

// Lead Source Breakdown
async function getSourceBreakdown(range: DateRange = {}) {
    const dateFilter = getDateFilter(range);

    const sources = await LeadModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const sourceColors: Record<string, string> = {
        manual: '#3b82f6',
        imported: '#22c55e',
        website: '#8b5cf6',
    };

    return sources.map((s) => ({
        name: s._id || 'unknown',
        value: s.count,
        color: sourceColors[s._id] || '#94a3b8',
    }));
}

// Country Distribution
async function getCountryDistribution(range: DateRange = {}, limit = 10) {
    const dateFilter = getDateFilter(range);

    const countries = await LeadModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
    ]);

    return countries.map((c) => ({
        country: c._id || 'Unknown',
        count: c.count,
    }));
}

// Activity Timeline
async function getActivityTimeline(range: DateRange = {}, limit = 20) {
    const dateFilter = getDateFilter(range);

    const activities = await LogModel.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'firstName lastName email image')
        .lean();

    return activities;
}

// Team Activity Breakdown - User-wise and Status-wise with filters and pagination
interface TeamActivityParams extends DateRange {
    userId?: string;
    status?: string;
    groupId?: string;
    page?: number;
    limit?: number;
}

async function getTeamActivityBreakdown(params: TeamActivityParams = {}) {
    const { userId, status, groupId, page = 1, limit = 10 } = params;

    // Default to today if no range specified
    let startDate: Date;
    let endDate: Date;

    if (params.startDate) {
        startDate = new Date(params.startDate);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }

    if (params.endDate) {
        endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
    }

    // Build match stage with filters
    const matchStage: Record<string, unknown> = {
        updatedAt: { $gte: startDate, $lte: endDate },
        updatedBy: { $exists: true, $ne: null },
    };

    if (userId && userId !== 'all') {
        matchStage.updatedBy = new Types.ObjectId(userId);
    }
    if (status && status !== 'all') {
        matchStage.status = status;
    }
    if (groupId && groupId !== 'all') {
        matchStage.group = new Types.ObjectId(groupId);
    }

    // Get all leads updated in the date range, grouped by updatedBy user and status
    const breakdown = await LeadModel.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    user: '$updatedBy',
                    status: '$status',
                },
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: '$_id.user',
                statusBreakdown: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                    },
                },
                total: { $sum: '$count' },
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
        { $unwind: '$user' },
        {
            $project: {
                _id: 1,
                total: 1,
                statusBreakdown: 1,
                name: {
                    $concat: [
                        '$user.firstName',
                        ' ',
                        { $ifNull: ['$user.lastName', ''] },
                    ],
                },
                role: '$user.role',
                image: '$user.image',
            },
        },
        { $sort: { total: -1 } },
    ]);

    // Calculate grand total (before pagination)
    const grandTotal = breakdown.reduce((sum, user) => sum + user.total, 0);
    const totalUsers = breakdown.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedUsers = breakdown.slice(skip, skip + limit);

    return {
        grandTotal,
        users: paginatedUsers,
        pagination: {
            page,
            limit,
            totalUsers,
            totalPages: Math.ceil(totalUsers / limit),
        },
        dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
        },
    };
}

const AnalyticsService = {
    getOverviewStats,
    getLeadStatusDistribution,
    getLeadTrends,
    getTaskPerformance,
    getUserPerformance,
    getSourceBreakdown,
    getCountryDistribution,
    getActivityTimeline,
    getTeamActivityBreakdown,
};

export default AnalyticsService;
