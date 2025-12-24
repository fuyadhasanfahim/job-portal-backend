import { z } from 'zod';

export const newGroupValidation = z.object({
    name: z.string().min(1, 'Group name is required').max(50, 'Name too long'),
    description: z.string().max(200, 'Description too long').optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
        .optional()
        .default('#6366f1'),
});

export const updateGroupValidation = z.object({
    name: z.string().min(1, 'Group name is required').max(50).optional(),
    description: z.string().max(200).optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
        .optional(),
    isActive: z.boolean().optional(),
});

export type NewGroupInput = z.infer<typeof newGroupValidation>;
export type UpdateGroupInput = z.infer<typeof updateGroupValidation>;
