import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import ExcelJS from 'exceljs';

function getWeekDays(mondayDate: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SUB_COLS = ['Versement (FCFA)', 'Heures', 'Courses', 'Commentaire'];
const SUB_COUNT = SUB_COLS.length;

export async function GET() {
  try {
    await requireSession();

    const drivers = await prisma.driver.findMany({
      orderBy: [{ contractType: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, code: true, fullName: true, contractType: true },
    });

    const workbook = new ExcelJS.Workbook();
    const monday = getMondayOfWeek(new Date());
    const days = getWeekDays(monday);
    const weekLabel = `${days[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} – ${days[5].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    // One sheet per contract type (+ one combined)
    const groups: { label: string; drivers: typeof drivers }[] = [
      { label: 'Condition-Vente', drivers: drivers.filter((d) => d.contractType === 'CONDITION_VENTE') },
      { label: 'Location', drivers: drivers.filter((d) => d.contractType === 'LOCATION') },
      { label: 'Tous Chauffeurs', drivers },
    ];

    for (const group of groups) {
      if (group.drivers.length === 0) continue;
      const sheet = workbook.addWorksheet(group.label);

      // Total columns: 2 (Code + Nom) + 6 days * 4 sub-cols
      const totalCols = 2 + 6 * SUB_COUNT;

      // Row 1: Title
      sheet.mergeCells(1, 1, 1, totalCols);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = `EMPIRE-FLEET — Versements Semaine du ${weekLabel} — ${group.label}`;
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 28;

      // Row 2: Day headers (merged over sub-cols)
      sheet.getCell(2, 1).value = 'Code';
      sheet.getCell(2, 2).value = 'Nom Chauffeur';
      [sheet.getCell(2, 1), sheet.getCell(2, 2)].forEach((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      sheet.mergeCells(2, 1, 3, 1);
      sheet.mergeCells(2, 2, 3, 2);

      days.forEach((day, di) => {
        const startCol = 3 + di * SUB_COUNT;
        const endCol = startCol + SUB_COUNT - 1;
        sheet.mergeCells(2, startCol, 2, endCol);
        const cell = sheet.getCell(2, startCol);
        const dayLabel = `${DAY_LABELS[di]} ${day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
        cell.value = dayLabel;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        const bgColor = di % 2 === 0 ? 'FF0891B2' : 'FF0E7490';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { left: { style: 'medium', color: { argb: 'FF0891B2' } }, bottom: { style: 'thin' } };
      });
      sheet.getRow(2).height = 20;

      // Row 3: Sub-col headers
      days.forEach((_, di) => {
        const startCol = 3 + di * SUB_COUNT;
        SUB_COLS.forEach((sub, si) => {
          const cell = sheet.getCell(3, startCol + si);
          cell.value = sub;
          cell.font = { bold: true, size: 8, color: { argb: 'FF1A1A2E' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            bottom: { style: 'medium' },
            left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
            right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          };
        });
      });
      sheet.getRow(3).height = 30;

      // Column widths
      sheet.getColumn(1).width = 10;
      sheet.getColumn(2).width = 24;
      for (let di = 0; di < 6; di++) {
        const startCol = 3 + di * SUB_COUNT;
        sheet.getColumn(startCol).width = 16;     // Versement
        sheet.getColumn(startCol + 1).width = 8;  // Heures
        sheet.getColumn(startCol + 2).width = 8;  // Courses
        sheet.getColumn(startCol + 3).width = 18; // Commentaire
      }

      // Freeze first 3 rows + 2 cols
      sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];

      // Data rows
      group.drivers.forEach((d, idx) => {
        const rowNum = idx + 4;
        const row = sheet.getRow(rowNum);
        const bgEven = 'FFFAFAFA';
        const bgOdd = 'FFEFF6FF';
        const bg = idx % 2 === 0 ? bgEven : bgOdd;

        const codeCell = row.getCell(1);
        codeCell.value = d.code;
        codeCell.font = { bold: true, color: { argb: 'FF0891B2' } };
        codeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        codeCell.alignment = { horizontal: 'center' };

        const nameCell = row.getCell(2);
        nameCell.value = d.fullName;
        nameCell.font = { bold: true, color: { argb: 'FF111827' } };
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

        // Empty input cells for each day
        for (let di = 0; di < 6; di++) {
          const startCol = 3 + di * SUB_COUNT;
          for (let si = 0; si < SUB_COUNT; si++) {
            const cell = row.getCell(startCol + si);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            };
            // Versement column: number format
            if (si === 0) cell.numFmt = '#,##0';
          }
          // Left border between days
          row.getCell(3 + di * SUB_COUNT).border = {
            ...row.getCell(3 + di * SUB_COUNT).border,
            left: { style: 'medium', color: { argb: 'FF0891B2' } },
          };
        }

        row.height = 20;
      });

      // Total row
      const totalRowNum = group.drivers.length + 4;
      const totalRow = sheet.getRow(totalRowNum);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };

      for (let di = 0; di < 6; di++) {
        const startCol = 3 + di * SUB_COUNT;
        // Sum the Versement column
        const versCol = startCol;
        const dataStart = 4;
        const dataEnd = group.drivers.length + 3;
        const colLetter = sheet.getColumn(versCol).letter;
        const sumCell = totalRow.getCell(versCol);
        sumCell.value = { formula: `SUM(${colLetter}${dataStart}:${colLetter}${dataEnd})` };
        sumCell.numFmt = '#,##0';
        sumCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
        // Other sub-cols
        for (let si = 1; si < SUB_COUNT; si++) {
          const cell = totalRow.getCell(startCol + si);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        }
      }
      totalRow.height = 22;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="versements-semaine-${today}.xlsx"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
