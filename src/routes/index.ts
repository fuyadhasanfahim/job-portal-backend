import { Router } from 'express';
import { userRoute } from './user.route.js';
import { authRoute } from './auth.route.js';
import { leadRoute } from './lead.route.js';
import { countryRoute } from './country.route.js';
import { taskRoute } from './task.route.js';
import { logRoute } from './log.route.js';
import { trashRoute } from './trash.route.js';
import { groupRoute } from './group.route.js';
import { invitationRoute } from './invitation.route.js';
import { notificationRoute } from './notification.route.js';
import { analyticsRoute } from './analytics.route.js';

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
    {
        path: '/tasks',
        route: taskRoute,
    },
    {
        path: '/logs',
        route: logRoute,
    },
    {
        path: '/trash',
        route: trashRoute,
    },
    {
        path: '/groups',
        route: groupRoute,
    },
    {
        path: '/invitations',
        route: invitationRoute,
    },
    {
        path: '/notifications',
        route: notificationRoute,
    },
    {
        path: '/analytics',
        route: analyticsRoute,
    },
];

moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

export default router;
