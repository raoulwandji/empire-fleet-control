import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireStructureWriteWindow, handleAccessError, logAudit } from '@/lib/access';

// DELETE /api/business-units/stock-movements/[id]
// Corrige une saisie : n'autorisé que si c'est le mouvement le PLUS RÉCENT du produit
// (pour garder le stock cohérent sans recalcul historique), et dans la fenêtre de 5h
// pour un gestionnaire non-admin (ADMIN : toujours autorisé).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const movement = await prisma.stockMovement.findUnique({
      where: { id: params.id },
      include: { product: true },
    });
    if (!movement) {
      return NextResponse.json({ error: 'Mouvement introuvable.' }, { status: 404 });
    }

    await requireStructureWriteWindow(session.user.id, session.user.role, movement.product.businessUnit, movement.createdAt);

    const latest = await prisma.stockMovement.findFirst({
      where: { productId: movement.productId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest?.id !== movement.id) {
      return NextResponse.json(
        { error: "Seul le mouvement le plus récent de ce produit peut être supprimé, pour garder le stock cohérent." },
        { status: 400 }
      );
    }

    // Delta inverse pour remettre le stock dans l'état précédent.
    const inverseDelta = movement.type === 'VENTE' ? Math.abs(movement.quantity)
      : movement.type === 'APPRO' ? -Math.abs(movement.quantity)
      : -movement.quantity;

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.delete({ where: { id: movement.id } });
      await tx.product.update({
        where: { id: movement.productId },
        data: { quantityInStock: movement.product.quantityInStock + inverseDelta },
      });
      if (movement.accountingEntryId) {
        await tx.accountingEntry.delete({ where: { id: movement.accountingEntryId } }).catch(() => {});
      }
    });

    await logAudit(session.user.id, 'DELETE_STOCK_MOVEMENT', 'StockMovement', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
