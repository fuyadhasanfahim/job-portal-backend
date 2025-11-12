import type { Request, Response } from 'express';
import LogServices from '../services/log.service.js';
import { Roles } from '../constants/roles.js';

async function getLeadAnalytics(req: Request, res: Response) {
    try {
        const role = req.auth?.role;

        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Insufficient permissions',
            });
        }

        const { month } = req.query as { month?: string };

        const data = await LogServices.getLeadAnalyticsFromDB(month);
        return res.json({
            success: true,
            message: 'Lead analytics fetched successfully',
            data,
        });
    } catch (error) {
        console.error('Error fetching lead analytics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch lead analytics',
        });
    }
}

async function getTopUsers(req: Request, res: Response) {
    try {
        const role = req.auth?.role;

        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Insufficient permissions',
            });
        }

        const {
            page = '1',
            limit = '10',
            search = '',
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const result = await LogServices.getTopUsersFromDB({
            page: parsedPage,
            limit: parsedLimit,
            search,
        });

        return res.json({
            success: true,
            message: 'Top users fetched successfully',
            ...result,
        });
    } catch (error) {
        console.error('Error fetching top users:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch top users',
        });
    }
}

// NEW: Get user lead statistics for bar chart
async function getUserLeadStats(req: Request, res: Response) {
    try {
        const role = req.auth?.role;

        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Insufficient permissions',
            });
        }

        const { period = 'daily' } = req.query as {
            period?: 'hourly' | 'daily' | 'weekly' | 'monthly';
        };

        const validPeriods = ['hourly', 'daily', 'weekly', 'monthly'];
        const selectedPeriod = validPeriods.includes(period) ? period : 'daily';

        const data = await LogServices.getUserLeadStatsFromDB(
            selectedPeriod as 'hourly' | 'daily' | 'weekly' | 'monthly',
        );

        return res.json({
            success: true,
            message: 'User lead statistics fetched successfully',
            data,
        });
    } catch (error) {
        console.error('Error fetching user lead stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user lead statistics',
        });
    }
}

// NEW: Get top users pie chart data
async function getTopUsersPieChart(req: Request, res: Response) {
    try {
        const role = req.auth?.role;

        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Insufficient permissions',
            });
        }

        const { period = 'daily', limit = '10' } = req.query as {
            period?: 'hourly' | 'daily' | 'monthly';
            limit?: string;
        };

        const validPeriods = ['hourly', 'daily', 'monthly'];
        const selectedPeriod = validPeriods.includes(period) ? period : 'daily';
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            20,
        );

        const data = await LogServices.getTopUsersPieChartFromDB(
            selectedPeriod as 'hourly' | 'daily' | 'monthly',
            parsedLimit,
        );

        return res.json({
            success: true,
            message: 'Top users pie chart data fetched successfully',
            data,
        });
    } catch (error) {
        console.error('Error fetching top users pie chart:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch top users pie chart data',
        });
    }
}

// NEW: Get all users table data
async function getAllUsersTable(req: Request, res: Response) {
    try {
        const role = req.auth?.role;

        if (role !== Roles.SUPER_ADMIN && role !== Roles.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Insufficient permissions',
            });
        }

        const {
            page = '1',
            limit = '10',
            search = '',
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const result = await LogServices.getAllUsersTableFromDB({
            page: parsedPage,
            limit: parsedLimit,
            search,
        });

        return res.json({
            success: true,
            message: 'Users table data fetched successfully',
            ...result,
        });
    } catch (error) {
        console.error('Error fetching users table:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch users table data',
        });
    }
}

const logController = {
    getLeadAnalytics,
    getTopUsers,
    getUserLeadStats,
    getTopUsersPieChart,
    getAllUsersTable,
};

export default logController;
