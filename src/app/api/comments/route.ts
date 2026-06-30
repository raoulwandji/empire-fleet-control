import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { commentCreateSchema } from '@/lib/validation';

// GET /api/comments?driverId=... — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    const comments = await prisma.comment.findMany({
      where: driverId ? { driverId } : undefined,
      include: { author: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(comments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/comments — admin, ou employe affecte au chauffeur
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = commentCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const comment = await prisma.comment.create({
      data: {
        driverId: data.driverId,
        text: data.text,
        authorId: session.user.id,
      },
    });

    await logAudit(session.user.id, 'CREATE_COMMENT', 'Comment', comment.id, { driverId: data.driverId });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
