import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingOwnerCreateSchema } from '@/lib/validation';
import { Prisma } from '@prisma/client';

// GET /api/pending-owners?q=
// Liste des propriétaires en attente — lecture totale pour tout utilisateur authentifié.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    const where: Prisma.PendingOwnerWhereInput = {};
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pendingOwners = await prisma.pendingOwner.findMany({
      where,
      include: { enteredBy: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(pendingOwners);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/pending-owners — tout utilisateur authentifié peut ajouter un prospect propriétaire
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const data = pendingOwnerCreateSchema.parse(body);

    const pendingOwner = await prisma.pendingOwner.create({
      data: { ...data, enteredById: session.user.id },
    });

    await logAudit(session.user.id, 'CREATE_PENDING_OWNER', 'PendingOwner', pendingOwner.id, data);

    return NextResponse.json(pendingOwner, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
