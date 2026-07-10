import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireStructureAccess, handleAccessError, logAudit } from '@/lib/access';
import { productCreateSchema } from '@/lib/validation';

// GET /api/business-units/products?businessUnit=... — lecture totale pour tout utilisateur authentifié
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const businessUnit = searchParams.get('businessUnit');

    const products = await prisma.product.findMany({
      where: businessUnit ? { businessUnit: businessUnit as any } : undefined,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/business-units/products — ADMIN ou gestionnaire affecté à la structure
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = productCreateSchema.parse(body);

    await requireStructureAccess(session.user.id, session.user.role, data.businessUnit);

    const product = await prisma.product.create({
      data: {
        businessUnit: data.businessUnit,
        name: data.name,
        unitPrice: data.unitPrice,
        quantityInStock: data.quantityInStock,
        createdById: session.user.id,
      },
    });

    await logAudit(session.user.id, 'CREATE_PRODUCT', 'Product', product.id, data);

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
