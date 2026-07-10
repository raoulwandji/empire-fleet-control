import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingDriverCommentCreateSchema } from '@/lib/validation';

// GET /api/pending-drivers/[id]/comments — lecture totale
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const comments = await prisma.pendingDriverComment.findMany({
      where: { pendingDriverId: params.id },
      include: { author: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(comments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/pending-drivers/[id]/comments — tout utilisateur authentifié
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = pendingDriverCommentCreateSchema.parse({ ...body, pendingDriverId: params.id });

    const comment = await prisma.pendingDriverComment.create({
      data: { pendingDriverId: data.pendingDriverId, text: data.text, authorId: session.user.id },
      include: { author: { select: { fullName: true, username: true } } },
    });

    await logAudit(session.user.id, 'CREATE_PENDING_DRIVER_COMMENT', 'PendingDriverComment', comment.id, {
      pendingDriverId: params.id,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
