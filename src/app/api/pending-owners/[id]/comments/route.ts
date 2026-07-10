import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingOwnerCommentCreateSchema } from '@/lib/validation';

// GET /api/pending-owners/[id]/comments — lecture totale
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const comments = await prisma.pendingOwnerComment.findMany({
      where: { pendingOwnerId: params.id },
      include: { author: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(comments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/pending-owners/[id]/comments — tout utilisateur authentifié
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = pendingOwnerCommentCreateSchema.parse({ ...body, pendingOwnerId: params.id });

    const comment = await prisma.pendingOwnerComment.create({
      data: { pendingOwnerId: data.pendingOwnerId, text: data.text, authorId: session.user.id },
      include: { author: { select: { fullName: true, username: true } } },
    });

    await logAudit(session.user.id, 'CREATE_PENDING_OWNER_COMMENT', 'PendingOwnerComment', comment.id, {
      pendingOwnerId: params.id,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
