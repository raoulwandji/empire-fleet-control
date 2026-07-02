import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit, requireCapability } from '@/lib/access';
import { z } from 'zod';

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  capabilities: z.record(z.boolean()).optional(),
});

// PATCH /api/users/[id] — nécessite la capacité "users_manage"
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    await requireCapability(session.user.id, session.user.role, 'users_manage');

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Seul l'ADMIN peut changer un rôle ou modifier les capacités d'un utilisateur
    if (session.user.role !== 'ADMIN' && data.role !== undefined) {
      return NextResponse.json({ error: 'Seul un administrateur peut modifier le rôle d\'un utilisateur.' }, { status: 403 });
    }
    if (session.user.role !== 'ADMIN' && data.capabilities !== undefined) {
      return NextResponse.json({ error: 'Seul un administrateur peut modifier les capacités d\'un utilisateur.' }, { status: 403 });
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
