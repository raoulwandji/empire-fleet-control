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

    const payment = await prisma.payment.create({
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

    await logAudit(session.user.id, 'CREATE_PAYMENT', 'Payment', payment.id, {
      driverId: data.driverId,
      amount: data.amount,
      unusual,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
