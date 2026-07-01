import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

const PAGE_SIZE = 50;

// GET /api/chat?cursor=<id>&since=<isoDate> — messages récents
// ?since= retourne uniquement le count des messages plus récents que cette date
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const cursor = req.nextUrl.searchParams.get('cursor');
    const since = req.nextUrl.searchParams.get('since');

    // Mode "count non lus" — utilisé par la navbar
    if (since) {
      const sinceDate = new Date(since);
      const count = await prisma.chatMessage.count({
        where: {
          createdAt: { gt: sinceDate },
          authorId: { not: session.user.id }, // ne pas compter ses propres messages
        },
      });
      return NextResponse.json({ count });
    }

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
