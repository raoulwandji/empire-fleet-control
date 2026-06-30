import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';

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

const credentialsSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
  username: z.string().min(3, 'Identifiant trop court.').optional(),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères.').optional(),
});

// PATCH /api/profile — l'utilisateur connecté modifie son propre identifiant et/ou mot de passe
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = credentialsSchema.parse(await req.json());

    if (!data.username && !data.newPassword) {
      return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 });
    }

    if (data.username && data.username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username } });
      if (existing) {
        return NextResponse.json({ error: 'Cet identifiant est déjà utilisé.' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.username) updateData.username = data.username;
    if (data.newPassword) updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, username: true, fullName: true, role: true, avatarUrl: true },
    });

    await logAudit(session.user.id, 'UPDATE_OWN_CREDENTIALS', 'User', user.id, {
      fields: Object.keys(updateData),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}
