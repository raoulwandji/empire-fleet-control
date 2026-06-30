import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { buildExcelBuffer, Column } from '@/lib/export';
import { buildPdfBuffer } from '@/lib/pdf';
import { formatFCFA } from '@/lib/business';
import { Prisma } from '@prisma/client';

const columns: Column[] = [
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Montant', key: 'amount', width: 16 },
  { header: 'Mode de paiement', key: 'paymentMode', width: 16 },
  { header: 'Jour inhabituel', key: 'unusual', width: 14 },
  { header: 'Commentaire', key: 'comment', width: 24 },
  { header: 'Saisi par', key: 'enteredBy', width: 18 },
];

// GET /api/payments/export?driverId=...&from=&to=&format=pdf|excel
// Feuille de versement (ou loyer) d'un chauffeur, filtrable par plage de dates.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format') ?? 'excel';

    if (!driverId) {
      return NextResponse.json({ error: 'driverId requis.' }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const where: Prisma.PaymentWhereInput = { driverId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { enteredBy: { select: { fullName: true } } },
      orderBy: { date: 'asc' },
    });

    const label = driver.contractType === 'CONDITION_VENTE' ? 'Versements' : 'Loyers';
    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const rows = payments.map((p) => ({
      date: new Date(p.date).toLocaleDateString('fr-FR'),
      amount: formatFCFA(Number(p.amount)),
      paymentMode: p.paymentMode,
      unusual: p.isUnusualDay ? 'Oui' : '',
      comment: p.comment ?? '',
      enteredBy: p.enteredBy.fullName,
    }));

    rows.push({
      date: '',
      amount: `TOTAL: ${formatFCFA(total)}`,
      paymentMode: '',
      unusual: '',
      comment: '',
      enteredBy: '',
    });

    const title = `EMPIRE-FLEET CONTROL — Feuille de ${label.toLowerCase()} — ${driver.fullName} (${driver.code})`;

    if (format === 'pdf') {
      const buffer = await buildPdfBuffer(title, columns, rows);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="feuille-${driver.code}.pdf"`,
        },
      });
    }

    const buffer = await buildExcelBuffer(label, columns, rows);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="feuille-${driver.code}.xlsx"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
