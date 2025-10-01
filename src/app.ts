import express, {
    type Application,
    type Request,
    type Response,
} from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import router from './routes/index.js';
import env from './config/env.js';

const app: Application = express();

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
);

app.use(
    cors({
        origin: env.cors_origin,
        credentials: true,
    }),
);

app.use(express.json());

app.use(cookieParser());

app.use('/api/v1', router);

app.use('/', (_req: Request, res: Response) => {
    res.send('🚀 Server is running successfully.');
});

export default app;
