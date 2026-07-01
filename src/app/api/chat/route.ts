import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

const PAGE_SIZE = 50;

// GET /api/chat?cursor=<id> — derniers messages (50), du plus récent au plus ancien
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const cursor = req.nextUrl.searchParams.get('cursor');

    const messages = await prisma.chatMessage.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, fullName: true, username: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(messages);
  } catch (err) {
    return handleAccessError(err);
  }
}

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// POST /api/chat — envoyer un message
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { content } = messageSchema.parse(await req.json());

    const message = await prisma.chatMessage.create({
      data: { content, authorId: session.user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, fullName: true, username: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
