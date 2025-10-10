import { Router, type Request, type Response } from 'express';
import CountryModel from '../models/country.model.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

// ✅ Add a new country
router.post(
    '/new-country',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { name } = req.body;

            if (!name || typeof name !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Country name is required',
                });
            }

            const country = await CountryModel.create({
                name: name.toLowerCase(),
            });

            return res.status(201).json({
                success: true,
                message: 'Country created successfully',
                data: country,
            });
        } catch (error) {
            console.error('Error creating country:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create country',
            });
        }
    },
);

// ✅ Get all countries
router.get(
    '/get-countries',
    requireAuth,
    async (_req: Request, res: Response) => {
        try {
            const countries = await CountryModel.find({}).lean();

            return res.status(200).json({
                success: true,
                data: countries,
            });
        } catch (error) {
            console.error('Error fetching countries:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch countries',
            });
        }
    },
);

export const countryRoute = router;
