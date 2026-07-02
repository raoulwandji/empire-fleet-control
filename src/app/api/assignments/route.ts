import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError, logAudit , requireCapability } from '@/lib/access';
import { assignmentCreateSchema } from '@/lib/validation';

// GET /api/assignments — reserve a l'admin (vue de gestion complete)
export async function GET() {
  try {
    const session = await requireSession();
    await requireCapability(session.user.id, session.user.role, 'assignments');

    const assignments = await prisma.assignment.findMany({
      include: {
        employee: { select: { id: true, fullName: true, username: true } },
        driver: { select: { id: true, fullName: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assignments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/assignments — reserve a l'admin
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    await requireCapability(session.user.id, session.user.role, 'assignments');

    const body = await req.json();
    const data = assignmentCreateSchema.parse(body);

    const existing = await prisma.assignment.findUnique({
      where: { employeeId_driverId: { employeeId: data.employeeId, driverId: data.driverId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Cette affectation existe déjà.' }, { status: 409 });
    }

    const assignment = await prisma.assignment.create({
      data: { employeeId: data.employeeId, driverId: data.driverId },
      include: {
        employee: { select: { id: true, fullName: true } },
        driver: { select: { id: true, fullName: true, code: true } },
      },
    });

    await logAudit(session.user.id, 'CREATE_ASSIGNMENT', 'Assignment', assignment.id, data);

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
