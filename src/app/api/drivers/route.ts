import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit } from '@/lib/access';
import { driverCreateSchema } from '@/lib/validation';
import { generateDriverCode } from '@/lib/driverCode';
import { Prisma } from '@prisma/client';

// GET /api/drivers?q=&contractType=&from=&to=
// Visibilite totale en lecture pour tout utilisateur authentifie.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const contractType = searchParams.get('contractType');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Prisma.DriverWhereInput = {};

    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { vehiclePlate: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (contractType === 'CONDITION_VENTE' || contractType === 'LOCATION') {
      where.contractType = contractType;
    }

    if (from || to) {
      where.vehicleInService = {};
      if (from) where.vehicleInService.gte = new Date(from);
      if (to) where.vehicleInService.lte = new Date(to);
    }

    const drivers = await prisma.driver.findMany({
      where,
      include: {
        assignments: { include: { employee: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcul du statut "a versé aujourd'hui" pour chaque chauffeur
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const paidTodayIds = await prisma.payment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      select: { driverId: true },
      distinct: ['driverId'],
    });
    const paidSet = new Set(paidTodayIds.map((p) => p.driverId));

    const result = drivers.map((d) => ({ ...d, paidToday: paidSet.has(d.id) }));

    return NextResponse.json(result);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/drivers — creation reservee a l'admin
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    const body = await req.json();
    const data = driverCreateSchema.parse(body);

    const code = await generateDriverCode(data.contractType);

    const driver = await prisma.driver.create({
      data: {
        code,
        fullName: data.fullName,
        phone: data.phone,
        location: data.location,
        licenseNumber: data.licenseNumber,
        contractType: data.contractType,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerLocation: data.ownerLocation,
        guarantorName: data.guarantorName,
        guarantorPhone: data.guarantorPhone,
        vehicleBrand: data.vehicleBrand,
        vehicleModel: data.vehicleModel,
        vehiclePlate: data.vehiclePlate,
        vehicleColor: data.vehicleColor,
        vehicleInService: data.vehicleInService ? new Date(data.vehicleInService) : null,
        totalPriceFixed: data.totalPriceFixed,
        cautionReference: data.cautionReference,
        cautionMinThreshold: data.cautionMinThreshold,
        hourlyPenaltyRate: data.hourlyPenaltyRate,
        weeklyHourTarget: data.weeklyHourTarget,
      },
    });

    if (data.contractType === 'LOCATION' && data.cautionReference) {
      const movement = await prisma.cautionMovement.create({
        data: {
          driverId: driver.id,
          date: new Date(),
          type: 'DEPOT_INITIAL',
          amount: data.cautionReference,
          reason: 'Dépôt initial à la création du profil',
          resultBalance: data.cautionReference,
          enteredById: session.user.id,
        },
      });
      void movement;
    }

    await logAudit(session.user.id, 'CREATE_DRIVER', 'Driver', driver.id, { code });

    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
