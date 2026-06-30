import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

// GET /api/profile — informations du compte connecté (y compris photo de profil)
export async function GET() {
  try {
    const session = await requireSession();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, fullName: true, role: true, avatarUrl: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    return handleAccessError(err);
  }
}
