import { createServer } from 'http';
import { connect } from 'mongoose';
import app from './app.js';
import env from './config/env.js';
import { initSocket } from './lib/socket.js';

const { port, mongo_uri } = env;

async function Server() {
    try {
        await connect(mongo_uri as string);
        console.log('✅ MongoDB connected');

        const server = createServer(app);

        initSocket(server);

        server.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('🚫 Error connecting to database:', error);
        process.exit(1);
    }
}

Server();
