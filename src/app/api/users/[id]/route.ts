import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, requireAdminOrManager, handleAccessError, logAudit } from '@/lib/access';
import { z } from 'zod';

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PATCH /api/users/[id] — admin + manager (manager ne peut pas changer le rôle)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Un gestionnaire ne peut pas modifier le rôle d'un autre utilisateur
    if (session.user.role === 'MANAGER' && data.role !== undefined) {
      return NextResponse.json({ error: 'Un gestionnaire ne peut pas modifier le rôle d\'un utilisateur.' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { ...data };
    delete updateData.password;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, username: true, fullName: true, role: true, active: true },
    });

    await logAudit(session.user.id, 'UPDATE_USER', 'User', user.id, { fields: Object.keys(data) });

    return NextResponse.json(user);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/users/[id] — ADMIN uniquement
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    if (session.user.id === params.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_USER', 'User', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
