import { prisma } from '@/lib/prisma';
import { ContractType } from '@prisma/client';

export async function generateDriverCode(contractType: ContractType): Promise<string> {
  const prefix = contractType === 'CONDITION_VENTE' ? 'CH' : 'LOC';

  const last = await prisma.driver.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: 'desc' },
  });

  let nextNumber = 1;
  if (last) {
    const match = last.code.match(/-(\d+)$/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}
