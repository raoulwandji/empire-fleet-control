import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireStructureAccess, handleAccessError, logAudit } from '@/lib/access';
import { productUpdateSchema } from '@/lib/validation';

// PATCH /api/business-units/products/[id] — édition du catalogue (nom, prix, actif) —
// pas de fenêtre de 5h ici : c'est une fiche produit, pas une transaction ponctuelle.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    }
    await requireStructureAccess(session.user.id, session.user.role, product.businessUnit);

    const body = await req.json();
    const data = productUpdateSchema.parse(body);

    const updated = await prisma.product.update({ where: { id: params.id }, data });
    await logAudit(session.user.id, 'UPDATE_PRODUCT', 'Product', updated.id, data);

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/business-units/products/[id] — retire un produit du catalogue
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    }
    await requireStructureAccess(session.user.id, session.user.role, product.businessUnit);

    await prisma.product.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_PRODUCT', 'Product', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
