import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.string().default('3306'),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default('eventhub'),
  JWT_SECRET: z.string().default('eventhub_default_development_jwt_secret_key_must_be_long'),
  JWT_EXPIRES_IN: z.string().default('86400'),
  ADMIN_NAME: z.string().default('Campus Administrator'),
  ADMIN_EMAIL: z.string().default('admin@eventhub.campus.edu'),
  ADMIN_PASSWORD: z.string().default('AdminPassword123!')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
