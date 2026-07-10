import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, requireStructureAccess, handleAccessError, logAudit } from '@/lib/access';

const businessUnitEnum = z.enum([
  'EMPIRE_ASSURANCE',
  'AUTO_ECOLE_EMPIRE',
  'EMPIRE_LANGUAGE_ACADEMY',
  'EMPIRE_TRAVEL',
  'EMPIRE_DRIVE',
  'EMPIRE_SECURE',
]);

const createSchema = z.object({
  date: z.string().min(1),
  type: z.enum(['ENTREE', 'SORTIE']),
  category: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE', 'PORTEFEUILLE']).default('ESPECES'),
  note: z.string().optional(),
  // Rattachement optionnel à une structure Empire Group (ex: vente de service).
  businessUnit: businessUnitEnum.optional(),
});

// GET /api/accounting?from=&to=&type=&businessUnit= — tous les utilisateurs authentifiés
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type');
    const businessUnit = searchParams.get('businessUnit');

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
    if (businessUnit === 'NONE') {
      where.businessUnit = null;
    } else if (businessUnit) {
      where.businessUnit = businessUnit;
    }

    const entries = await prisma.accountingEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { enteredBy: { select: { fullName: true, username: true } } },
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
        businessUnit: e.businessUnit,
        createdAt: e.createdAt,
        enteredBy: `${e.enteredBy.fullName} (@${e.enteredBy.username})`,
      }))
    );
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/accounting — tous les utilisateurs authentifiés pour une écriture générale ;
// si businessUnit est précisé, seul l'ADMIN ou un gestionnaire affecté à cette structure peut écrire.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.businessUnit) {
      await requireStructureAccess(session.user.id, session.user.role, data.businessUnit);
    }

    const entry = await prisma.accountingEntry.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        category: data.category,
        label: data.label,
        amount: data.amount,
        paymentMode: data.paymentMode,
        note: data.note,
        businessUnit: data.businessUnit,
        enteredById: session.user.id,
      },
    });

    await logAudit(session.user.id, 'CREATE_ACCOUNTING', 'AccountingEntry', entry.id, {
      type: data.type,
      amount: data.amount,
      businessUnit: data.businessUnit,
    });

    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
