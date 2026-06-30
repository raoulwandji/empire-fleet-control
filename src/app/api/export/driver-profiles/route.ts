import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    await requireSession();

    const drivers = await prisma.driver.findMany({
      orderBy: [{ contractType: 'asc' }, { createdAt: 'desc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Profils Chauffeurs');

    // Title row
    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'EMPIRE-FLEET CONTROL — Profils Chauffeurs';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Section headers row
    const headerRow = sheet.getRow(2);
    const headers = [
      { v: 'Code', w: 10 },
      { v: 'Nom Complet', w: 24 },
      { v: 'Téléphone', w: 16 },
      { v: 'Localisation', w: 20 },
      { v: 'N° Permis', w: 16 },
      { v: 'Contrat', w: 14 },
      { v: 'Propriétaire', w: 22 },
      { v: 'Tél. Propriétaire', w: 18 },
      { v: 'Localisation Proprio', w: 22 },
      { v: 'Garant', w: 22 },
      { v: 'Tél. Garant', w: 16 },
    ];

    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h.v;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0891B2' } },
        bottom: { style: 'thin', color: { argb: 'FF0891B2' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
      sheet.getColumn(i + 1).width = h.w;
    });
    headerRow.height = 22;

    // Data rows
    drivers.forEach((d, idx) => {
      const row = sheet.getRow(idx + 3);
      const isCV = d.contractType === 'CONDITION_VENTE';
      const bgColor = idx % 2 === 0 ? 'FFF9FAFB' : 'FFEFF6FF';

      const values = [
        d.code,
        d.fullName,
        d.phone,
        d.location ?? '',
        d.licenseNumber,
        isCV ? 'Condition-Vente' : 'Location',
        d.ownerName,
        d.ownerPhone ?? '',
        d.ownerLocation ?? '',
        d.guarantorName ?? '',
        d.guarantorPhone ?? '',
      ];

      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { color: { argb: 'FF111827' } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        // Highlight contract type
        if (i === 5) {
          cell.font = {
            bold: true,
            color: { argb: isCV ? 'FF0891B2' : 'FF16A34A' },
          };
        }
      });
      row.height = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="profils-chauffeurs-${today}.xlsx"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
