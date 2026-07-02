import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { resolveCapabilities } from '@/lib/capabilities';

// GET /api/me — capacités effectives de l'utilisateur connecté (pour la navigation)
export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, capabilities: true },
    });
    if (!user) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    return NextResponse.json({
      role: user.role,
      capabilities: resolveCapabilities(user.role, user.capabilities),
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
