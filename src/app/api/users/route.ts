import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError, logAudit } from '@/lib/access';
import { userCreateSchema } from '@/lib/validation';

// GET /api/users — admin + manager
export async function GET() {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const users = await prisma.user.findMany({
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/users — admin + manager (manager ne peut pas créer de compte ADMIN)
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const body = await req.json();
    const data = userCreateSchema.parse(body);

    // Un gestionnaire ne peut pas créer de compte administrateur
    if (session.user.role === 'MANAGER' && data.role === 'ADMIN') {
      return NextResponse.json({ error: 'Un gestionnaire ne peut pas créer un compte administrateur.' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      return NextResponse.json({ error: 'Cet identifiant existe déjà.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
      },
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
    });

    await logAudit(session.user.id, 'CREATE_USER', 'User', user.id, { username: data.username, role: data.role });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
