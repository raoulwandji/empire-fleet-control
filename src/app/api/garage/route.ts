import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { garageEntryCreateSchema } from '@/lib/validation';
import { Prisma } from '@prisma/client';

// GET /api/garage?status=active|resolved|all&q=&from=&to= — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'active';
    const q = searchParams.get('q')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Prisma.GarageEntryWhereInput = {};
    if (status === 'active') where.resolvedAt = null;
    else if (status === 'resolved') where.resolvedAt = { not: null };

    if (from || to) {
      where.enteredAt = {};
      if (from) (where.enteredAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (where.enteredAt as Prisma.DateTimeFilter).lte = end;
      }
    }

    if (q) {
      where.driver = {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { vehiclePlate: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const entries = await prisma.garageEntry.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, code: true, vehiclePlate: true, contractType: true } },
        enteredBy: { select: { fullName: true, username: true } },
      },
      orderBy: { enteredAt: 'desc' },
    });

    return NextResponse.json(entries);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/garage — admin, ou employé affecté au chauffeur : immobilise un véhicule
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = garageEntryCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const existingActive = await prisma.garageEntry.findFirst({
      where: { driverId: data.driverId, resolvedAt: null },
    });
    if (existingActive) {
      return NextResponse.json(
        { error: 'Ce véhicule est déjà immobilisé au garage. Remettez-le en service avant une nouvelle entrée.' },
        { status: 409 }
      );
    }

    const entry = await prisma.garageEntry.create({
      data: {
        driverId: data.driverId,
        reasonType: data.reasonType,
        reason: data.reason,
        enteredAt: new Date(data.enteredAt),
        note: data.note,
        enteredById: session.user.id,
      },
      include: {
        driver: { select: { id: true, fullName: true, code: true, vehiclePlate: true, contractType: true } },
        enteredBy: { select: { fullName: true, username: true } },
      },
    });

    await logAudit(session.user.id, 'CREATE_GARAGE_ENTRY', 'GarageEntry', entry.id, { driverId: data.driverId });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
