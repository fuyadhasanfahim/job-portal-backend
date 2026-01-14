import type { Request, Response } from 'express';
import AnalyticsService from '../services/analytics.service.js';
import { Roles } from '../constants/roles.js';

// Helper to parse date range from query
function parseDateRange(req: Request) {
    const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
    };
    return { startDate, endDate };
}

// GET /analytics/overview
async function getOverview(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const data = await AnalyticsService.getOverviewStats(range);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching overview:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch overview stats',
        });
    }
}

// GET /analytics/lead-status
async function getLeadStatus(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const data = await AnalyticsService.getLeadStatusDistribution(range);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching lead status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch lead status distribution',
        });
    }
}

// GET /analytics/lead-trends
async function getLeadTrends(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const { period = 'daily' } = req.query as {
            period?: 'daily' | 'weekly' | 'monthly';
        };

        const data = await AnalyticsService.getLeadTrends(period, range);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching lead trends:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch lead trends',
        });
    }
}

// GET /analytics/task-performance
async function getTaskPerformance(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const data = await AnalyticsService.getTaskPerformance(range);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching task performance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch task performance',
        });
    }
}

// GET /analytics/user-performance
async function getUserPerformance(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const { limit = '10' } = req.query as { limit?: string };
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            50,
        );

        const data = await AnalyticsService.getUserPerformance(
            range,
            parsedLimit,
        );

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching user performance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user performance',
        });
    }
}

// GET /analytics/sources
async function getSources(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const data = await AnalyticsService.getSourceBreakdown(range);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching sources:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch source breakdown',
        });
    }
}

// GET /analytics/countries
async function getCountries(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const { limit = '10' } = req.query as { limit?: string };
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            50,
        );

        const data = await AnalyticsService.getCountryDistribution(
            range,
            parsedLimit,
        );

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching countries:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch country distribution',
        });
    }
}

// GET /analytics/activity
async function getActivity(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const range = parseDateRange(req);
        const { limit = '20' } = req.query as { limit?: string };
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 20, 1),
            100,
        );

        const data = await AnalyticsService.getActivityTimeline(
            range,
            parsedLimit,
        );

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch activity timeline',
        });
    }
}

// GET /analytics/todays-work
async function getTodaysWork(req: Request, res: Response) {
    try {
        const role = req.auth?.role;
        if (
            role !== Roles.SUPER_ADMIN &&
            role !== Roles.ADMIN &&
            role !== 'team-leader'
        ) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const {
            startDate,
            endDate,
            userId,
            status,
            groupId,
            page = '1',
            limit = '10',
        } = req.query as {
            startDate?: string;
            endDate?: string;
            userId?: string;
            status?: string;
            groupId?: string;
            page?: string;
            limit?: string;
        };

        const params: {
            startDate?: string;
            endDate?: string;
            userId?: string;
            status?: string;
            groupId?: string;
            page: number;
            limit: number;
        } = {
            page: parseInt(page, 10) || 1,
            limit: Math.min(parseInt(limit, 10) || 10, 50),
        };

        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (userId) params.userId = userId;
        if (status) params.status = status;
        if (groupId) params.groupId = groupId;

        const data = await AnalyticsService.getTeamActivityBreakdown(params);

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching team activity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch team activity breakdown',
        });
    }
}

const analyticsController = {
    getOverview,
    getLeadStatus,
    getLeadTrends,
    getTaskPerformance,
    getUserPerformance,
    getSources,
    getCountries,
    getActivity,
    getTodaysWork,
};

export default analyticsController;
