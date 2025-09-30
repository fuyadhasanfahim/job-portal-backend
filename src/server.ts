import { createServer } from 'http';
import { connect } from 'mongoose';
import app from './app.js';
import env from './config/env.js';

const { port, mongo_uri } = env;

async function Server() {
    try {
        await connect(mongo_uri as string);

        const server = createServer(app);

        server.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
        });
    } catch (error) {
        console.error('🚫 Error connecting to database:', error);
        process.exit(1);
    }
}

Server();
