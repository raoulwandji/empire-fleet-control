import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireStructureAccess, handleAccessError, logAudit } from '@/lib/access';
import { stockMovementCreateSchema } from '@/lib/validation';

// GET /api/business-units/stock-movements?productId=... ou ?businessUnit=... — lecture totale
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const businessUnit = searchParams.get('businessUnit');

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(productId ? { productId } : {}),
        ...(businessUnit ? { product: { businessUnit: businessUnit as any } } : {}),
      },
      include: {
        product: { select: { id: true, name: true, businessUnit: true } },
        enteredBy: { select: { fullName: true, username: true } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(movements);
  } catch (err) {
    return handleAccessError(err);
  }
}

// POST /api/business-units/stock-movements — vente / réappro / ajustement.
// VENTE décrémente le stock et génère automatiquement une recette comptable.
// APPRO incrémente le stock et peut générer une dépense comptable (coût d'achat).
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = stockMovementCreateSchema.parse(body);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    }
    await requireStructureAccess(session.user.id, session.user.role, product.businessUnit);

    const unitPrice = data.unitPrice ?? Number(product.unitPrice);
    const date = new Date(data.date);

    // Delta de stock signé selon le type de mouvement.
    const delta = data.type === 'VENTE' ? -Math.abs(data.quantity)
      : data.type === 'APPRO' ? Math.abs(data.quantity)
      : data.quantity; // AJUSTEMENT : signé tel quel

    if (product.quantityInStock + delta < 0) {
      return NextResponse.json(
        { error: `Stock insuffisant (${product.quantityInStock} en stock).` },
        { status: 400 }
      );
    }

    const totalAmount = Math.abs(data.quantity) * unitPrice;

    const result = await prisma.$transaction(async (tx) => {
      const newStock = product.quantityInStock + delta;

      // Génère automatiquement une écriture comptable pour une VENTE, ou pour un
      // APPRO si le coût d'achat doit être enregistré.
      let accountingEntry = null;
      if (data.type === 'VENTE') {
        accountingEntry = await tx.accountingEntry.create({
          data: {
            date,
            type: 'ENTREE',
            category: product.name,
            label: `Vente ${product.name} × ${Math.abs(data.quantity)}`,
            amount: totalAmount,
            businessUnit: product.businessUnit,
            note: data.note,
            enteredById: session.user.id,
          },
        });
      } else if (data.type === 'APPRO' && data.recordCost) {
        accountingEntry = await tx.accountingEntry.create({
          data: {
            date,
            type: 'SORTIE',
            category: product.name,
            label: `Achat stock ${product.name} × ${Math.abs(data.quantity)}`,
            amount: totalAmount,
            businessUnit: product.businessUnit,
            note: data.note,
            enteredById: session.user.id,
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: data.type,
          quantity: data.quantity,
          unitPrice,
          totalAmount,
          resultStock: newStock,
          date,
          note: data.note,
          enteredById: session.user.id,
          accountingEntryId: accountingEntry?.id,
        },
      });

      await tx.product.update({ where: { id: product.id }, data: { quantityInStock: newStock } });

      return movement;
    });

    await logAudit(session.user.id, 'CREATE_STOCK_MOVEMENT', 'StockMovement', result.id, {
      productId: product.id,
      type: data.type,
      quantity: data.quantity,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
