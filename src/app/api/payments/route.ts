import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { paymentCreateSchema } from '@/lib/validation';
import { isUnusualPaymentDay } from '@/lib/business';

// GET /api/payments?driverId=... — lecture totale pour tout utilisateur authentifie
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    const payments = await prisma.payment.findMany({
      where: driverId ? { driverId } : undefined,
      include: { enteredBy: { select: { fullName: true, username: true } }, driver: { select: { fullName: true, code: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/payments — admin, ou employe affecte au chauffeur concerne
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = paymentCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const date = new Date(data.date);
    const unusual = isUnusualPaymentDay(date);

    // Mouvement de portefeuille intégré à la saisie du versement (CV uniquement) :
    // dépôt du surplus ou retrait pour couvrir une partie du versement via le solde existant.
    if (data.walletMovement) {
      const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
      if (!driver || driver.contractType !== 'CONDITION_VENTE') {
        return NextResponse.json(
          { error: 'Le portefeuille concerne uniquement les chauffeurs Condition-Vente.' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          driverId: data.driverId,
          date,
          amount: data.amount,
          paymentMode: data.paymentMode,
          comment: data.comment,
          isUnusualDay: unusual,
          enteredById: session.user.id,
        },
      });

      let movement = null;
      if (data.walletMovement) {
        const signedAmount = data.walletMovement.type === 'RETRAIT'
          ? -Math.abs(data.walletMovement.amount)
          : Math.abs(data.walletMovement.amount);

        const agg = await tx.walletMovement.aggregate({
          where: { driverId: data.driverId },
          _sum: { amount: true },
        });
        const newBalance = Number(agg._sum.amount ?? 0) + signedAmount;

        movement = await tx.walletMovement.create({
          data: {
            driverId: data.driverId,
            date,
            type: data.walletMovement.type,
            amount: signedAmount,
            reason: `Intégré au versement du ${date.toLocaleDateString('fr-FR')}`,
            resultBalance: newBalance,
            enteredById: session.user.id,
          },
        });
      }

      return { payment, movement };
    });

    await logAudit(session.user.id, 'CREATE_PAYMENT', 'Payment', result.payment.id, {
      driverId: data.driverId,
      amount: data.amount,
      unusual,
      walletMovement: data.walletMovement ?? undefined,
    });

    return NextResponse.json({ ...result.payment, walletMovement: result.movement }, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
