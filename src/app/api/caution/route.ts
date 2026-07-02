import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { cautionMovementCreateSchema } from '@/lib/validation';

// GET /api/caution?driverId=... — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    const movements = await prisma.cautionMovement.findMany({
      where: driverId ? { driverId } : undefined,
      include: { enteredBy: { select: { fullName: true } }, driver: { select: { fullName: true, code: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(movements);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/caution — admin, ou employe affecte. Recalcule le solde en temps reel.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = cautionMovementCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }
    // En Location : caution classique. En Condition-Vente : avance de remboursement
    // déduite du reste à verser pour l'acquisition du véhicule.

    const isDeduction = data.type === 'DEDUCTION_PANNE' || data.type === 'DEDUCTION_SANCTION' || data.type === 'RETRAIT';
    const signedAmount = isDeduction ? -Math.abs(data.amount) : Math.abs(data.amount);

    const result = await prisma.$transaction(async (tx) => {
      const agg = await tx.cautionMovement.aggregate({
        where: { driverId: data.driverId },
        _sum: { amount: true },
      });
      const currentBalance = Number(agg._sum.amount ?? 0);
      const newBalance = currentBalance + signedAmount;

      const movement = await tx.cautionMovement.create({
        data: {
          driverId: data.driverId,
          date: new Date(data.date),
          type: data.type,
          amount: signedAmount,
          reason: data.reason,
          resultBalance: newBalance,
          enteredById: session.user.id,
        },
      });

      return { movement, newBalance };
    });

    await logAudit(session.user.id, 'CREATE_CAUTION_MOVEMENT', 'CautionMovement', result.movement.id, {
      driverId: data.driverId,
      type: data.type,
      amount: signedAmount,
      newBalance: result.newBalance,
    });

    const belowThreshold =
      driver.cautionMinThreshold != null && result.newBalance < Number(driver.cautionMinThreshold);

    return NextResponse.json({ ...result.movement, belowThreshold }, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
