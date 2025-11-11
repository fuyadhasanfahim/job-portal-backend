import type { Request, Response } from 'express';
import LogServices from '../services/log.service.js';

async function getLogs(req: Request, res: Response) {
    try {
        const {
            page = '1',
            limit = '50',
            action,
            entityType,
            userId,
            startDate,
            endDate,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query as {
            page: string;
            limit: string;
            action?: string;
            entityType?: string;
            userId?: string;
            startDate?: string;
            endDate?: string;
            search?: string;
            sortBy?: string;
            sortOrder: string;
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 50, 1),
            200,
        );

        const params: {
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
        } = {
            page: parsedPage,
            limit: parsedLimit,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc',
        };

        if (action !== undefined) params.action = action;
        if (entityType !== undefined) params.entityType = entityType;
        if (userId !== undefined) params.userId = userId;
        if (startDate !== undefined) params.startDate = startDate;
        if (endDate !== undefined) params.endDate = endDate;
        if (search !== undefined) params.search = search;

        const result = await LogServices.getLogsFromDB(params);

        return res.json({
            success: true,
            logs: result.items,
            pagination: result.pagination,
            stats: result.stats,
        });
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ success: false, message: 'Failed to fetch logs' });
    }
}

const logController = { getLogs };
export default logController;
