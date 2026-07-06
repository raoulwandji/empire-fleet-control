import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
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

    // Statut de versement : on prend en compte le JOUR EN COURS (aujourd'hui) et,
    // en complément, la veille (pour signaler un versement fait hier mais pas encore aujourd'hui).
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const [paidTodayRows, paidYesterdayRows] = await Promise.all([
      prisma.payment.findMany({
        where: { date: { gte: todayStart, lte: todayEnd } },
        select: { driverId: true },
        distinct: ['driverId'],
      }),
      prisma.payment.findMany({
        where: { date: { gte: yesterdayStart, lte: yesterdayEnd } },
        select: { driverId: true },
        distinct: ['driverId'],
      }),
    ]);
    const paidTodaySet = new Set(paidTodayRows.map((p) => p.driverId));
    const paidYesterdaySet = new Set(paidYesterdayRows.map((p) => p.driverId));

    const result = drivers.map((d) => ({
      ...d,
      paidToday: paidTodaySet.has(d.id),
      paidYesterday: paidYesterdaySet.has(d.id),
    }));

    return NextResponse.json(result);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/drivers — admin ET employé peuvent créer un chauffeur
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

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
        ownerId: data.ownerId || undefined,
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

    // Caution / avance versée à la création — pour LOCATION comme pour CONDITION-VENTE.
    // En Condition-Vente, cette caution est une avance de remboursement qui sera
    // déduite du reste à verser pour l'acquisition du véhicule.
    if (data.cautionReference && data.cautionReference > 0) {
      const reason =
        data.contractType === 'CONDITION_VENTE'
          ? 'Avance / caution initiale (déduite du reste à verser)'
          : 'Dépôt initial à la création du profil';
      await prisma.cautionMovement.create({
        data: {
          driverId: driver.id,
          date: new Date(),
          type: 'DEPOT_INITIAL',
          amount: data.cautionReference,
          reason,
          resultBalance: data.cautionReference,
          enteredById: session.user.id,
        },
      });
    }

    await logAudit(session.user.id, 'CREATE_DRIVER', 'Driver', driver.id, { code });

    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
