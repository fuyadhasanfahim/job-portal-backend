import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
});

const env = {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    mongo_uri: process.env.MONGO_URI,
    access_secret: process.env.JWT_ACCESS_SECRET!,
    refresh_secret: process.env.JWT_REFRESH_SECRET!,
    access_expires: process.env.ACCESS_EXPIRES!,
    refresh_expires: process.env.REFRESH_EXPIRES!,
    cookie_domain: process.env.COOKIE_DOMAIN,
    cors_origin: process.env.CORS_ORIGIN!,
};

export default env;
