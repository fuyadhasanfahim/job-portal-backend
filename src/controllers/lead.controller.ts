import { type Request, type Response } from 'express';
import LeadService from '../services/lead.service.js';
import {
    newLeadValidation,
    updateLeadValidation,
} from '../validators/lead.validator.js';
import z from 'zod';
import {
    parseCSV,
    parseExcel,
    validateImportSchema,
    validateRowData,
    type ParsedRow,
    type SchemaValidationResult,
    type RowValidationError,
} from '../helpers/fileParser.js';

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
            group = '',
            source = '',
            importBatchId = '',
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
            group: string;
            source: string;
            importBatchId: string;
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
        if (source.trim()) filters.source = source.trim();
        if (importBatchId.trim()) filters.importBatchId = importBatchId.trim();

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
            ...(group.trim() ? { group: group.trim() } : {}),
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
        const { groupId } = req.body as { groupId?: string };

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

        const file = files[0];
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file provided',
            });
        }

        // Parse the file first
        let parsedData: ParsedRow[];

        try {
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
                return res.status(400).json({
                    success: false,
                    message: `Unsupported file type: ${file.originalname}. Please upload a CSV or Excel file.`,
                });
            }
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                message: `Error parsing file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            });
        }

        if (parsedData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The file is empty or contains no data rows.',
            });
        }

        // Validate schema/columns first
        const schemaValidation: SchemaValidationResult =
            validateImportSchema(parsedData);

        if (!schemaValidation.valid) {
            return res.status(400).json({
                success: false,
                message: 'File structure does not match the expected format.',
                validationErrors: schemaValidation.errors,
                warnings: schemaValidation.warnings,
                detectedColumns: schemaValidation.detectedColumns,
                expectedColumns: schemaValidation.expectedColumns,
            });
        }

        // Validate individual rows and collect errors
        const rowErrors: RowValidationError[] = [];
        const validRows: ParsedRow[] = [];
        const invalidRowIndices = new Set<number>(); // Track unique invalid rows

        for (let i = 0; i < parsedData.length; i++) {
            const row = parsedData[i];
            if (!row) continue;

            const errors = validateRowData(row, i);
            if (errors.length > 0) {
                rowErrors.push(...errors);
                invalidRowIndices.add(i); // Track this row as invalid
            } else {
                validRows.push(row);
            }
        }

        // If all rows are invalid, return error
        if (validRows.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    'No valid rows found in the file. All rows have validation errors.',
                rowErrors: rowErrors.slice(0, 50), // Limit to first 50 errors
                totalRowErrors: rowErrors.length,
                warnings: schemaValidation.warnings,
            });
        }

        // Process valid leads
        const importResult = await LeadService.importLeadsFromData(
            validRows,
            userId,
            file?.originalname,
            groupId,
        );

        // Combine row validation errors with import errors
        const allErrors = [
            ...rowErrors.map((e) => e.message),
            ...importResult.errors,
        ];

        // Calculate correct counts
        const skippedRowCount = invalidRowIndices.size; // Unique invalid rows count

        res.status(200).json({
            success: true,
            message: 'Leads import completed',
            results: {
                total: parsedData.length,
                validRows: validRows.length,
                successful: importResult.successful,
                duplicates: importResult.failed,
                skippedRows: skippedRowCount, // Fixed: count unique rows, not errors
                errors: allErrors.slice(0, 100), // Limit errors in response
                totalErrors: allErrors.length,
            },
            warnings: schemaValidation.warnings,
        });
    } catch (error) {
        console.error('Error importing leads:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during import',
        });
    }
}

async function searchLeadByCompany(req: Request, res: Response) {
    try {
        const { name, website } = req.query as {
            name?: string;
            website?: string;
        };

        if (!name && !website) {
            return res.status(400).json({
                success: false,
                message: 'Please provide company name or website to search',
            });
        }

        const lead = await LeadService.searchLeadByCompany({
            companyName: name || undefined,
            website: website || undefined,
        });

        return res.status(200).json({
            success: true,
            found: !!lead,
            lead: lead || null,
        });
    } catch (error) {
        console.error('Error searching lead by company:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search lead',
        });
    }
}

async function addContactPerson(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required',
            });
        }

        const contactPerson = req.body;

        if (!contactPerson.emails || contactPerson.emails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one email is required for contact person',
            });
        }

        if (!contactPerson.phones || contactPerson.phones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one phone is required for contact person',
            });
        }

        const lead = await LeadService.addContactPersonToLead(
            id,
            userId,
            contactPerson,
        );

        return res.status(200).json({
            success: true,
            message: 'Contact person added successfully',
            lead,
        });
    } catch (error) {
        console.error('Error adding contact person:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to add contact person',
        });
    }
}

async function bulkAssign(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Only admins can bulk assign
        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can bulk assign leads',
            });
        }

        const { leadIds, targetUserId } = req.body as {
            leadIds: string[];
            targetUserId: string;
        };

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide lead IDs to assign',
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide target user ID',
            });
        }

        const result = await LeadService.bulkAssignLeads(
            leadIds,
            targetUserId,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: `Successfully assigned ${result.success} leads`,
            results: result,
        });
    } catch (error) {
        console.error('Error bulk assigning leads:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to assign leads',
        });
    }
}

async function getAllMatchingLeadIds(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Only admins can get all matching lead IDs
        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can perform bulk operations',
            });
        }

        const { search, status, country, selectedUserId, group } =
            req.query as {
                search?: string;
                status?: string;
                country?: string;
                selectedUserId?: string;
                group?: string;
            };

        const leadIds = await LeadService.getAllMatchingLeadIds({
            search,
            status,
            country,
            userId,
            selectedUserId,
            group,
        });

        return res.status(200).json({
            success: true,
            count: leadIds.length,
            leadIds,
        });
    } catch (error) {
        console.error('Error getting matching lead IDs:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to get lead IDs',
        });
    }
}

async function bulkChangeGroup(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { leadIds, targetGroupId } = req.body as {
            leadIds: string[];
            targetGroupId: string | null;
        };

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'leadIds array is required',
            });
        }

        const results = await LeadService.bulkChangeGroup(
            leadIds,
            targetGroupId,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: `Successfully changed group for ${results.success} leads`,
            results,
        });
    } catch (error) {
        console.error('Error in bulk change group:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to change group',
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
    searchLeadByCompany,
    addContactPerson,
    bulkAssign,
    getAllMatchingLeadIds,
    bulkChangeGroup,
};
export default LeadController;
