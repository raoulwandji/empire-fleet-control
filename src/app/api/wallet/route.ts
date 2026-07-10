import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { walletMovementCreateSchema } from '@/lib/validation';

// GET /api/wallet?driverId=... — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    const movements = await prisma.walletMovement.findMany({
      where: driverId ? { driverId } : undefined,
      include: { enteredBy: { select: { fullName: true, username: true } }, driver: { select: { fullName: true, code: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(movements);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/wallet — admin, ou employé affecté. Recalcule le solde en temps réel.
// Réservé aux chauffeurs Condition-Vente : réserve de trésorerie (surplus/avance courante),
// distincte de l'avance/caution déduite du reste à verser pour l'acquisition du véhicule.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = walletMovementCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }
    if (driver.contractType !== 'CONDITION_VENTE') {
      return NextResponse.json(
        { error: 'Le portefeuille concerne uniquement les chauffeurs Condition-Vente.' },
        { status: 400 }
      );
    }

    const signedAmount = data.type === 'RETRAIT' ? -Math.abs(data.amount) : Math.abs(data.amount);

    const result = await prisma.$transaction(async (tx) => {
      const agg = await tx.walletMovement.aggregate({
        where: { driverId: data.driverId },
        _sum: { amount: true },
      });
      const currentBalance = Number(agg._sum.amount ?? 0);
      const newBalance = currentBalance + signedAmount;

      const movement = await tx.walletMovement.create({
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

    await logAudit(session.user.id, 'CREATE_WALLET_MOVEMENT', 'WalletMovement', result.movement.id, {
      driverId: data.driverId,
      type: data.type,
      amount: signedAmount,
      newBalance: result.newBalance,
    });

    return NextResponse.json(result.movement, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
