/* Centralizes context database access so server modules share one connection and transaction convention. */
import type { Prisma, PrismaClient } from '@prisma/client';
import { AccountType } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma.js';

type TransactionClient = Prisma.TransactionClient;

export type DbContext = {
  userId?: string | null;
  organizationId?: string | null;
  accountType?: AccountType | keyof typeof AccountType | null;
  capabilities?: string[];
};

type DbContextTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

export async function withDbContext<T>(
  context: DbContext,
  work: (tx: TransactionClient) => Promise<T>,
  client: PrismaClient = defaultPrisma,
  options?: DbContextTransactionOptions
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId ?? ''}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${context.organizationId ?? ''}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_account_type', ${String(context.accountType ?? AccountType.USER).toLowerCase()}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_capabilities', ${(context.capabilities ?? []).join(',')}, true)`;

    return work(tx);
  }, options);
}
