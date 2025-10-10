import { Router } from 'express';
import { userRoute } from './user.route.js';
import { authRoute } from './auth.route.js';
import { leadRoute } from './lead.route.js';
import { countryRoute } from './country.route.js';

const router: Router = Router();

const moduleRoutes = [
    {
        path: '/auth',
        route: authRoute,
    },
    {
        path: '/users',
        route: userRoute,
    },
    {
        path: '/leads',
        route: leadRoute,
    },
    {
        path: '/countries',
        route: countryRoute,
    },
];

moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

export default router;
