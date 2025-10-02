import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: Server | null = null;

// cache progress per uploadId
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastProgress: Record<string, any> = {};

export function initSocket(server: HTTPServer) {
    io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket) => {
        console.log('⚡ Client connected:', socket.id);

        socket.on('import:subscribe', ({ uploadId }: { uploadId: string }) => {
            const room = getImportRoom(uploadId);
            socket.join(room);
            socket.emit('import:subscribed', { room });

            // replay last known progress if exists
            if (lastProgress[uploadId]) {
                socket.emit('import:progress', lastProgress[uploadId]);
            }
        });

        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);
        });
    });

    return io;
}

export function getIO(): Server {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
}

export function getImportRoom(uploadId: string) {
    return `import-leads:${uploadId}`;
}

// emit + cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitImportProgress(uploadId: string, payload: any) {
    lastProgress[uploadId] = payload; // store latest
    getIO().to(getImportRoom(uploadId)).emit('import:progress', payload);
}
