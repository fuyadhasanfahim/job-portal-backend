import { type Request, type Response } from 'express';
import LeadService from '../services/lead.service.js';
import {
    newLeadValidation,
    updateLeadValidation,
} from '../validators/lead.validator.js';
import z from 'zod';
import { parseCSV, parseExcel, type ParsedRow } from '../helpers/fileParser.js';

async function getLeads(req: Request, res: Response) {
    try {
        const {
            page = '1',
            limit = '10',
            search = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            country = '',
            date = '',
            selectedUserId,
        } = req.query as {
            page: string;
            limit: string;
            search: string;
            status: string;
            sortBy: string;
            sortOrder: string;
            country: string;
            outcome: string;
            date: string;
            selectedUserId: string;
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Missing user authentication',
            });
        }

        const filters: Record<string, string> = {};
        if (search.trim()) filters.search = search.trim();
        if (status.trim()) filters.status = status.trim();
        if (country.trim()) filters.country = country.trim();

        const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
        const validSortBy = [
            'createdAt',
            'company.name',
            'status',
            'country',
        ].includes(sortBy)
            ? sortBy
            : 'createdAt';

        const result = await LeadService.getLeadsFromDB({
            page: parsedPage,
            limit: parsedLimit,
            sortBy: validSortBy,
            sortOrder: validSortOrder,
            userId,
            ...filters,
            date,
            selectedUserId,
        });

        return res.status(200).json({
            success: true,
            message: 'Leads fetched successfully',
            data: result.items,
            pagination: {
                totalItems: result.pagination?.totalItems ?? 0,
                totalPages: result.pagination?.totalPages ?? 1,
                currentPage: parsedPage,
                limit: parsedLimit,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch leads',
        });
    }
}

async function getLeadsByDate(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Missing user authentication',
            });
        }

        const {
            page = '1',
            limit = '10',
            date,
        } = req.query as Record<string, string>;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date (YYYY-MM-DD)',
            });
        }

        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD',
            });
        }

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await LeadService.getLeadsByDateFromDB({
            userId,
            page: parsedPage,
            limit: parsedLimit,
            startOfDay,
            endOfDay,
        });

        return res.status(200).json({
            success: true,
            message: 'Leads fetched successfully',
            date,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('getLeadsByDate error:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch leads',
        });
    }
}

async function getLeadById(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required.',
            });
        }

        if (!userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const lead = await LeadService.getLeadByIdFromDB(id, userId, userRole);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found',
            });
        }

        return res.status(200).json({
            success: true,
            lead,
        });
    } catch (error) {
        console.error('Error fetching lead by ID:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch lead',
        });
    }
}

async function newLead(req: Request, res: Response) {
    try {
        const ownerId = req.auth?.id;

        if (!ownerId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const parsed = newLeadValidation.parse(req.body);

        const result = await LeadService.newLeadsInDB(ownerId, parsed);

        if (result.duplicate) {
            return res.status(200).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('New lead error:', error);
        return res
            .status(500)
            .json({ success: false, message: 'Failed to create lead' });
    }
}

async function updateLead(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required.',
            });
        }

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const body = req.body;

        const parsed = updateLeadValidation.parse(body);

        const lead = await LeadService.updateLeadInDB(id, userId, role, parsed);

        res.status(200).json({
            success: true,
            message: 'Lead updated successfully',
            lead,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        if (typeof error === 'object' && error !== null && 'status' in error) {
            const err = error as { status: number; message: string };
            if (err.status === 403) {
                return res.status(403).json({
                    success: false,
                    message: err.message,
                });
            }
        }

        console.error('Error updating lead:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
}

async function importLeads(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const files = req.files as Express.Multer.File[];

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded',
            });
        }

        const results = {
            total: 0,
            successful: 0,
            failed: 0,
            errors: [] as string[],
        };

        // Process each file
        for (const file of files) {
            try {
                let parsedData: ParsedRow[];

                if (
                    file.mimetype === 'text/csv' ||
                    file.originalname.endsWith('.csv')
                ) {
                    parsedData = await parseCSV(file.path);
                } else if (
                    file.mimetype ===
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.originalname.endsWith('.xlsx') ||
                    file.originalname.endsWith('.xls')
                ) {
                    parsedData = await parseExcel(file.path);
                } else {
                    results.errors.push(
                        `Unsupported file type: ${file.originalname}`,
                    );
                    continue;
                }

                if (parsedData.length === 0) {
                    results.errors.push(
                        `No data found in file: ${file.originalname}`,
                    );
                    continue;
                }

                // Process leads from this file
                const fileResults = await LeadService.importLeadsFromData(
                    parsedData,
                    userId,
                );

                results.total += fileResults.total;
                results.successful += fileResults.successful;
                results.failed += fileResults.failed;
                results.errors.push(...fileResults.errors);
            } catch (error) {
                results.errors.push(
                    `Error processing file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Leads import completed',
            results,
        });
    } catch (error) {
        console.error('Error importing leads:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during import',
        });
    }
}

const LeadController = {
    newLead,
    getLeads,
    getLeadsByDate,
    getLeadById,
    updateLead,
    importLeads,
};
export default LeadController;
