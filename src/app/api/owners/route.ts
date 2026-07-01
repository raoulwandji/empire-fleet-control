import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminOrManager, requireSession, handleAccessError } from '@/lib/access';

// GET /api/owners — liste tous les propriétaires
export async function GET() {
  try {
    await requireSession();
    const owners = await prisma.owner.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, phone: true, location: true },
    });
    return NextResponse.json(owners);
  } catch (err) {
    return handleAccessError(err);
  }
}

const ownerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  location: z.string().optional(),
});

// POST /api/owners — créer un propriétaire
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = ownerSchema.parse(await req.json());
    const owner = await prisma.owner.create({ data: body });
    return NextResponse.json(owner, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
