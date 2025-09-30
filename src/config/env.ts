import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
});

const env = {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    mongo_uri: process.env.MONGO_URI,
};

export default env;
