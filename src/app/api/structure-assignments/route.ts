import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit } from '@/lib/access';
import { structureAssignmentCreateSchema } from '@/lib/validation';

// GET /api/structure-assignments — admin uniquement : vue globale des affectations
export async function GET() {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    const assignments = await prisma.structureAssignment.findMany({
      include: { user: { select: { id: true, fullName: true, username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assignments);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/structure-assignments — admin uniquement : affecte un utilisateur à une structure
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    const body = await req.json();
    const data = structureAssignmentCreateSchema.parse(body);

    const existing = await prisma.structureAssignment.findUnique({
      where: { userId_businessUnit: { userId: data.userId, businessUnit: data.businessUnit } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Cet utilisateur gère déjà cette structure.' }, { status: 409 });
    }

    const assignment = await prisma.structureAssignment.create({
      data,
      include: { user: { select: { id: true, fullName: true, username: true, role: true } } },
    });

    await logAudit(session.user.id, 'CREATE_STRUCTURE_ASSIGNMENT', 'StructureAssignment', assignment.id, data);

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
