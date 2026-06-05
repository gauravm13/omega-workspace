import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@auth/adapter-pg';

const connectionString = process.env.DATABASE_URL;

const prismaClientSingleton = () => {
  // Configured with maximum connection parameters optimized for serverless tiers
  const pool = new Pool({ 
    connectionString,
    max: 4,                  // Strictly bounds pool allocation per serverless instance
    idleTimeoutMillis: 30000, // Forces fast cleanup of dead pool tasks
    connectionTimeoutMillis: 2000,
  });
  
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;