import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
});
