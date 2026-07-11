import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { garageEntryUpdateSchema } from '@/lib/validation';

// PATCH /api/garage/[id] — corrige le motif/date/note d'une immobilisation
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const entry = await prisma.garageEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
    }
    await requireDriverWriteAccess(session.user.id, session.user.role, entry.driverId);

    const body = await req.json();
    const data = garageEntryUpdateSchema.parse(body);

    const updated = await prisma.garageEntry.update({
      where: { id: params.id },
      data: { ...data, enteredAt: data.enteredAt ? new Date(data.enteredAt) : undefined },
      include: {
        driver: { select: { id: true, fullName: true, code: true, vehiclePlate: true, contractType: true } },
        enteredBy: { select: { fullName: true, username: true } },
      },
    });

    await logAudit(session.user.id, 'UPDATE_GARAGE_ENTRY', 'GarageEntry', updated.id, data);

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/garage/[id] — retire l'entrée (ex: saisie erronée)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const entry = await prisma.garageEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
    }
    await requireDriverWriteAccess(session.user.id, session.user.role, entry.driverId);

    await prisma.garageEntry.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_GARAGE_ENTRY', 'GarageEntry', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
