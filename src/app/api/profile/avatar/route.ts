import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { z } from 'zod';

// Data URL base64 — limite ~ 800 Ko encodé (image déjà compressée côté client)
const MAX_LEN = 800_000;

const avatarSchema = z.object({
  avatarUrl: z
    .string()
    .max(MAX_LEN, 'Image trop volumineuse.')
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Format image invalide.')
    .nullable(),
});

// PATCH /api/profile/avatar — chaque compte peut modifier sa propre photo de profil
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const { avatarUrl } = avatarSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    await logAudit(session.user.id, 'UPDATE_AVATAR', 'User', user.id);

    return NextResponse.json(user);
  } catch (err) {
    return handleAccessError(err);
  }
}
