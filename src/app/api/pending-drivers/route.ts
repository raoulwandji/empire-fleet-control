import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingDriverCreateSchema } from '@/lib/validation';
import { Prisma } from '@prisma/client';

// GET /api/pending-drivers?contractType=&q=
// Liste des chauffeurs en attente de véhicule — lecture totale pour tout utilisateur authentifié.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const contractType = searchParams.get('contractType');
    const q = searchParams.get('q')?.trim();

    const where: Prisma.PendingDriverWhereInput = {};
    if (contractType === 'CONDITION_VENTE' || contractType === 'LOCATION') {
      where.contractType = contractType;
    }
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pendingDrivers = await prisma.pendingDriver.findMany({
      where,
      include: { enteredBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(pendingDrivers);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/pending-drivers
// Contrairement aux chauffeurs avec véhicule, ce pool n'a pas de notion d'affectation :
// admin ET employé peuvent ajouter librement (pas de véhicule encore lié à protéger).
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const data = pendingDriverCreateSchema.parse(body);

    const pendingDriver = await prisma.pendingDriver.create({
      data: { ...data, enteredById: session.user.id },
    });

    await logAudit(session.user.id, 'CREATE_PENDING_DRIVER', 'PendingDriver', pendingDriver.id, data);

    return NextResponse.json(pendingDriver, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
