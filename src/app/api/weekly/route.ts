import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { weeklyTrackingCreateSchema } from '@/lib/validation';
import { computePenalty, getWeekStart } from '@/lib/business';

// GET /api/weekly?driverId=&weekStartDate= — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');
    const weekStartDate = searchParams.get('weekStartDate');

    const trackings = await prisma.weeklyTracking.findMany({
      where: {
        ...(driverId ? { driverId } : {}),
        ...(weekStartDate ? { weekStartDate: getWeekStart(new Date(weekStartDate)) } : {}),
      },
      include: { driver: { select: { fullName: true, code: true, contractType: true } } },
      orderBy: { weekStartDate: 'desc' },
    });

    return NextResponse.json(trackings);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/weekly — saisie hebdo heures+courses, calcule la penalite sans l'appliquer
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = weeklyTrackingCreateSchema.parse(body);

    await requireDriverWriteAccess(session.user.id, session.user.role, data.driverId);

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const weekStartDate = getWeekStart(new Date(data.weekStartDate));
    const hourTarget = driver.weeklyHourTarget;
    const penaltyRateUsed = Number(driver.hourlyPenaltyRate);
    const computedPenalty = computePenalty(data.hoursWorked, hourTarget, penaltyRateUsed);

    const tracking = await prisma.weeklyTracking.upsert({
      where: { driverId_weekStartDate: { driverId: data.driverId, weekStartDate } },
      update: {
        hoursWorked: data.hoursWorked,
        ridesCompleted: data.ridesCompleted,
        hourTarget,
        penaltyRateUsed,
        computedPenalty,
        enteredById: session.user.id,
      },
      create: {
        driverId: data.driverId,
        weekStartDate,
        hoursWorked: data.hoursWorked,
        ridesCompleted: data.ridesCompleted,
        hourTarget,
        penaltyRateUsed,
        computedPenalty,
        enteredById: session.user.id,
      },
    });

    await logAudit(session.user.id, 'CREATE_WEEKLY_TRACKING', 'WeeklyTracking', tracking.id, {
      driverId: data.driverId,
      hoursWorked: data.hoursWorked,
      ridesCompleted: data.ridesCompleted,
      computedPenalty,
    });

    return NextResponse.json(tracking, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
