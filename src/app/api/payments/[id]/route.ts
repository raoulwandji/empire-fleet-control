import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { isUnusualPaymentDay } from '@/lib/business';
import { z } from 'zod';

const paymentUpdateSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE']),
  comment: z.string().optional(),
});

// PATCH /api/payments/[id] — corriger une saisie manuelle de versement/loyer
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const payment = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!payment) {
      return NextResponse.json({ error: 'Versement introuvable.' }, { status: 404 });
    }

    await requireDriverWriteAccess(session.user.id, session.user.role, payment.driverId);

    const body = await req.json();
    const data = paymentUpdateSchema.parse(body);
    const date = new Date(data.date);
    const unusual = isUnusualPaymentDay(date);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        date,
        amount: data.amount,
        paymentMode: data.paymentMode,
        comment: data.comment || null,
        isUnusualDay: unusual,
      },
    });

    await logAudit(session.user.id, 'UPDATE_PAYMENT', 'Payment', payment.id, data);

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/payments/[id] — supprimer une saisie manuelle de versement/loyer
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const payment = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!payment) {
      return NextResponse.json({ error: 'Versement introuvable.' }, { status: 404 });
    }

    await requireDriverWriteAccess(session.user.id, session.user.role, payment.driverId);

    await prisma.payment.delete({ where: { id: payment.id } });
    await logAudit(session.user.id, 'DELETE_PAYMENT', 'Payment', payment.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
