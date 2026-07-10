import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { ownerCommentCreateSchema } from '@/lib/validation';

// GET /api/owners/[id]/comments — lecture totale
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const comments = await prisma.ownerComment.findMany({
      where: { ownerId: params.id },
      include: { author: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(comments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/owners/[id]/comments — tout utilisateur authentifié
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = ownerCommentCreateSchema.parse({ ...body, ownerId: params.id });

    const comment = await prisma.ownerComment.create({
      data: { ownerId: data.ownerId, text: data.text, authorId: session.user.id },
      include: { author: { select: { fullName: true, username: true } } },
    });

    await logAudit(session.user.id, 'CREATE_OWNER_COMMENT', 'OwnerComment', comment.id, { ownerId: params.id });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
