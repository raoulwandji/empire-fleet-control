import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';

// POST /api/garage/[id]/resolve — remet le véhicule en service (fin de la panne/réparation)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const entry = await prisma.garageEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
    }
    await requireDriverWriteAccess(session.user.id, session.user.role, entry.driverId);

    if (entry.resolvedAt) {
      return NextResponse.json({ error: 'Ce véhicule est déjà en service.' }, { status: 400 });
    }

    const updated = await prisma.garageEntry.update({
      where: { id: params.id },
      data: { resolvedAt: new Date() },
      include: {
        driver: { select: { id: true, fullName: true, code: true, vehiclePlate: true, contractType: true } },
        enteredBy: { select: { fullName: true, username: true } },
      },
    });

    await logAudit(session.user.id, 'RESOLVE_GARAGE_ENTRY', 'GarageEntry', updated.id, { driverId: entry.driverId });

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}
