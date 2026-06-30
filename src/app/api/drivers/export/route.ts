import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { buildExcelBuffer, Column } from '@/lib/export';
import { buildPdfBuffer } from '@/lib/pdf';
import { formatFCFA } from '@/lib/business';
import { Prisma } from '@prisma/client';

const columns: Column[] = [
  { header: 'Code', key: 'code', width: 12 },
  { header: 'Nom', key: 'fullName', width: 22 },
  { header: 'Téléphone', key: 'phone', width: 16 },
  { header: 'Contrat', key: 'contractType', width: 16 },
  { header: 'Véhicule', key: 'vehicle', width: 22 },
  { header: 'Plaque', key: 'vehiclePlate', width: 14 },
  { header: 'Propriétaire', key: 'ownerName', width: 20 },
  { header: 'Tél. propriétaire', key: 'ownerPhone', width: 16 },
  { header: 'Montant fixé / Caution', key: 'amountRef', width: 18 },
];

export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const contractType = searchParams.get('contractType');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format') ?? 'excel';

    const where: Prisma.DriverWhereInput = {};
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { vehiclePlate: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (contractType === 'CONDITION_VENTE' || contractType === 'LOCATION') {
      where.contractType = contractType;
    }
    if (from || to) {
      where.vehicleInService = {};
      if (from) where.vehicleInService.gte = new Date(from);
      if (to) where.vehicleInService.lte = new Date(to);
    }

    const drivers = await prisma.driver.findMany({ where, orderBy: { createdAt: 'desc' } });

    const rows = drivers.map((d) => ({
      code: d.code,
      fullName: d.fullName,
      phone: d.phone,
      contractType: d.contractType === 'CONDITION_VENTE' ? 'Condition-Vente' : 'Location',
      vehicle: `${d.vehicleBrand} ${d.vehicleModel}`,
      vehiclePlate: d.vehiclePlate,
      ownerName: d.ownerName,
      ownerPhone: d.ownerPhone,
      amountRef: formatFCFA(
        Number(d.contractType === 'CONDITION_VENTE' ? d.totalPriceFixed ?? 0 : d.cautionReference ?? 0)
      ),
    }));

    if (format === 'pdf') {
      const buffer = await buildPdfBuffer('EMPIRE-FLEET CONTROL — Liste des chauffeurs', columns, rows);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="chauffeurs.pdf"',
        },
      });
    }

    const buffer = await buildExcelBuffer('Chauffeurs', columns, rows);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="chauffeurs.xlsx"',
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
