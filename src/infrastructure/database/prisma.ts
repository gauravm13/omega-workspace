import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  
  const pool = new Pool({
    connectionString,
    max: 4,                  
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 2000,
    // CRITICAL FIX: Explicit SSL configuration is strictly required for Vercel Serverless -> Neon
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;