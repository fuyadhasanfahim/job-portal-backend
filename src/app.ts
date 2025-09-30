import express, {
    type Application,
    type Request,
    type Response,
} from 'express';

const app: Application = express();

app.use('/', (_req: Request, res: Response) => {
    res.send('🚀 Server is running successfully.');
});

export default app;
