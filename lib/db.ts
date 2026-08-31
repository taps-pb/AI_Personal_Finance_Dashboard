// Prisma client singleton (avoids exhausting connections on hot-reload).
// The money BigInt<->number boundary lives in prisma-money.ts.
import { makePrisma, type ExtendedPrisma } from "./prisma-money.ts";

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
