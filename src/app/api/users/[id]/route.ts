import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit } from '@/lib/access';
import { z } from 'zod';

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PATCH /api/users/[id] — reserve a l'admin (activer/desactiver, changer role/mdp)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    const body = await req.json();
    const data = updateSchema.parse(body);

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

// DELETE /api/users/[id] — reserve a l'admin
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
