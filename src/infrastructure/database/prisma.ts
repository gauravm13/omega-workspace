import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg'; // Explicit official Prisma adapter

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  
  // 1. Initialize the explicit Postgres pool for Vercel Serverless limitations
  const pool = new Pool({
    connectionString,
    max: 4,                  
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 2000,
  });
  
  // 2. Bind the native pool to Prisma's "client" engine via the driver adapter
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;