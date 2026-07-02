import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';

const createSchema = z.object({
  date: z.string().min(1),
  type: z.enum(['ENTREE', 'SORTIE']),
  category: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE']).default('ESPECES'),
  note: z.string().optional(),
});

// GET /api/accounting?from=&to=&type= — tous les utilisateurs authentifiés
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, Date>).lte = end;
      }
    }
    if (type === 'ENTREE' || type === 'SORTIE') where.type = type;

    const entries = await prisma.accountingEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { enteredBy: { select: { fullName: true } } },
      take: 500,
    });

    return NextResponse.json(
      entries.map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        category: e.category,
        label: e.label,
        amount: Number(e.amount),
        paymentMode: e.paymentMode,
        note: e.note,
        enteredBy: e.enteredBy.fullName,
      }))
    );
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/accounting — tous les utilisateurs authentifiés
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = createSchema.parse(body);

    const entry = await prisma.accountingEntry.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        category: data.category,
        label: data.label,
        amount: data.amount,
        paymentMode: data.paymentMode,
        note: data.note,
        enteredById: session.user.id,
      },
    });

    await logAudit(session.user.id, 'CREATE_ACCOUNTING', 'AccountingEntry', entry.id, {
      type: data.type,
      amount: data.amount,
    });

    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
