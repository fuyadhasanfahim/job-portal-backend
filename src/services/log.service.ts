import LogModel from '../models/logs.model.js';
import { Types, type FilterQuery } from 'mongoose';
import type { ILog } from '../types/logs.interface.js';

async function getLogsFromDB({
    page = 1,
    limit = 50,
    action,
    entityType,
    userId,
    startDate,
    endDate,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) {
    const query: FilterQuery<ILog> = {};

    if (action && action !== 'all') {
        query.action = action;
    }

    if (entityType && entityType !== 'all') {
        query.entityType = entityType;
    }

    if (userId && userId !== 'all') {
        query.user = new Types.ObjectId(userId);
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            query.createdAt.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ description: regex }, { action: regex }, { ip: regex }];
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
        LogModel.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('user', 'firstName lastName email role image')
            .lean(),
        LogModel.countDocuments(query),
    ]);

    const [actionStats, entityStats, userStats, hourlyStats, dailyStats] =
        await Promise.all([
            LogModel.aggregate([
                { $match: query },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            LogModel.aggregate([
                { $match: query },
                { $group: { _id: '$entityType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            LogModel.aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'userInfo',
                    },
                },
                {
                    $unwind: {
                        path: '$userInfo',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $group: {
                        _id: '$user',
                        count: { $sum: 1 },
                        firstName: { $first: '$userInfo.firstName' },
                        lastName: { $first: '$userInfo.lastName' },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            LogModel.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: { $hour: '$createdAt' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            LogModel.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: -1 } },
                { $limit: 30 },
            ]),
        ]);

    return {
        items,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
        stats: {
            actions: actionStats,
            entities: entityStats,
            users: userStats,
            hourly: hourlyStats,
            daily: dailyStats,
        },
    };
}

const LogServices = { getLogsFromDB };
export default LogServices;
