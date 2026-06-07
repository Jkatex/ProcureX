import { AccountType } from '@prisma/client';
import { prisma } from './db/prisma.js';
import { withDbContext } from './db/context.js';

async function main() {
  const company = await prisma.organization.findFirstOrThrow({ where: { kind: 'COMPANY' } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: 'demo@procurex.tz' } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: 'admin@procurex.tz' } });

  const tenderCount = await withDbContext(
    { userId: user.id, organizationId: company.id, accountType: AccountType.USER, capabilities: ['BUYER', 'SUPPLIER'] },
    (tx) => tx.tender.count({ where: { buyerOrgId: company.id } })
  );

  const bidCount = await withDbContext(
    { userId: user.id, organizationId: company.id, accountType: AccountType.USER, capabilities: ['BUYER', 'SUPPLIER'] },
    (tx) => tx.bid.count({ where: { supplierOrgId: company.id } })
  );

  const adminUserCount = await withDbContext(
    { userId: admin.id, accountType: AccountType.ADMIN },
    (tx) => tx.user.count()
  );

  if (tenderCount !== 0) throw new Error('Demo user should start with zero buyer tenders.');
  if (bidCount !== 0) throw new Error('Demo user should start with zero supplier bids.');
  if (adminUserCount < 2) throw new Error('Admin could not inspect seeded demo/admin users.');

  console.log('RLS verification passed for clean demo buyer/supplier context and admin inspection.');
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
