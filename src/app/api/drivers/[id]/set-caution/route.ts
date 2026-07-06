import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError, logAudit } from '@/lib/access';

const schema = z.object({ target: z.number().nonnegative() });

// POST /api/drivers/[id]/set-caution — admin + manager
// Définit la caution/avance TOTALE d'un chauffeur au montant exact fourni,
// en enregistrant un mouvement d'ajustement (le solde = somme des mouvements).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const { target } = schema.parse(await req.json());

    const driver = await prisma.driver.findUnique({ where: { id: params.id } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const agg = await tx.cautionMovement.aggregate({
        where: { driverId: params.id },
        _sum: { amount: true },
      });
      const current = Number(agg._sum.amount ?? 0);
      const delta = target - current;

      // Aucun changement nécessaire.
      if (Math.abs(delta) < 0.005) return { current, newBalance: current, changed: false };

      await tx.cautionMovement.create({
        data: {
          driverId: params.id,
          date: new Date(),
          type: delta > 0 ? 'RECHARGE_VOLONTAIRE' : 'RETRAIT',
          amount: delta,
          reason: `Correction de la caution → ${target.toLocaleString('fr-FR')} (ajustement ${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')})`,
          resultBalance: target,
          enteredById: session.user.id,
        },
      });

      return { current, newBalance: target, changed: true };
    });

    await logAudit(session.user.id, 'SET_CAUTION', 'Driver', params.id, { target, previous: result.current });

    return NextResponse.json(result);
  } catch (err) {
    return handleAccessError(err);
  }
}
