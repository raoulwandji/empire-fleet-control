import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import ExcelJS from 'exceljs';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return `${fmt(monday)}–${fmt(sunday)}`;
}

// 4 weeks: past 1 + current + next 2
const WEEK_COUNT = 4;
const SUB_COLS = ['Heures', 'Courses', 'Total Versement', 'Commentaire'];
const SUB_COUNT = SUB_COLS.length;

export async function GET() {
  try {
    await requireSession();

    const drivers = await prisma.driver.findMany({
      orderBy: [{ contractType: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, code: true, fullName: true, contractType: true },
    });

    const workbook = new ExcelJS.Workbook();

    const currentMonday = getMondayOfWeek(new Date());
    const weeks = Array.from({ length: WEEK_COUNT }, (_, i) => addWeeks(currentMonday, i - 1));

    const groups: { label: string; drivers: typeof drivers }[] = [
      { label: 'Condition-Vente', drivers: drivers.filter((d) => d.contractType === 'CONDITION_VENTE') },
      { label: 'Location', drivers: drivers.filter((d) => d.contractType === 'LOCATION') },
      { label: 'Tous Chauffeurs', drivers },
    ];

    for (const group of groups) {
      if (group.drivers.length === 0) continue;
      const sheet = workbook.addWorksheet(group.label);

      const totalCols = 2 + WEEK_COUNT * SUB_COUNT;

      // Row 1: Title
      sheet.mergeCells(1, 1, 1, totalCols);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = `EMPIRE-FLEET — Suivi Hebdomadaire — ${group.label}`;
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 28;

      // Row 2: fixed cols + week headers
      const fixedCells = [
        { r: 2, c: 1, v: 'Code' },
        { r: 2, c: 2, v: 'Nom Chauffeur' },
      ];
      fixedCells.forEach(({ r, c, v }) => {
        const cell = sheet.getCell(r, c);
        cell.value = v;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      sheet.mergeCells(2, 1, 3, 1);
      sheet.mergeCells(2, 2, 3, 2);

      weeks.forEach((monday, wi) => {
        const startCol = 3 + wi * SUB_COUNT;
        const endCol = startCol + SUB_COUNT - 1;
        sheet.mergeCells(2, startCol, 2, endCol);
        const cell = sheet.getCell(2, startCol);
        const isPast = monday < currentMonday;
        const isCurrent = monday.getTime() === currentMonday.getTime();
        cell.value = (isCurrent ? '▶ ' : '') + `Semaine ${formatWeekLabel(monday)}`;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        const bgColor = isPast ? 'FF6B7280' : isCurrent ? 'FF0891B2' : 'FF0E7490';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { left: { style: 'medium' }, bottom: { style: 'thin' } };
      });
      sheet.getRow(2).height = 20;

      // Row 3: Sub-col headers
      weeks.forEach((_, wi) => {
        const startCol = 3 + wi * SUB_COUNT;
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
      for (let wi = 0; wi < WEEK_COUNT; wi++) {
        const startCol = 3 + wi * SUB_COUNT;
        sheet.getColumn(startCol).width = 8;      // Heures
        sheet.getColumn(startCol + 1).width = 8;  // Courses
        sheet.getColumn(startCol + 2).width = 16; // Total Versement
        sheet.getColumn(startCol + 3).width = 20; // Commentaire
      }

      // Freeze first 3 rows + 2 cols
      sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];

      // Data rows
      group.drivers.forEach((d, idx) => {
        const rowNum = idx + 4;
        const row = sheet.getRow(rowNum);
        const bg = idx % 2 === 0 ? 'FFFAFAFA' : 'FFEFF6FF';

        const codeCell = row.getCell(1);
        codeCell.value = d.code;
        codeCell.font = { bold: true, color: { argb: 'FF0891B2' } };
        codeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        codeCell.alignment = { horizontal: 'center' };

        const nameCell = row.getCell(2);
        nameCell.value = d.fullName;
        nameCell.font = { bold: true, color: { argb: 'FF111827' } };
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

        for (let wi = 0; wi < WEEK_COUNT; wi++) {
          const startCol = 3 + wi * SUB_COUNT;
          for (let si = 0; si < SUB_COUNT; si++) {
            const cell = row.getCell(startCol + si);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            };
            if (si === 2) cell.numFmt = '#,##0'; // Total Versement
          }
          row.getCell(startCol).border = {
            ...row.getCell(startCol).border,
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
      [1, 2].forEach((c) =>
        (totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } })
      );

      for (let wi = 0; wi < WEEK_COUNT; wi++) {
        const startCol = 3 + wi * SUB_COUNT;
        const dataStart = 4;
        const dataEnd = group.drivers.length + 3;
        // Sum Heures and Total Versement
        [0, 2].forEach((si) => {
          const colLetter = sheet.getColumn(startCol + si).letter;
          const cell = totalRow.getCell(startCol + si);
          cell.value = { formula: `SUM(${colLetter}${dataStart}:${colLetter}${dataEnd})` };
          cell.numFmt = si === 2 ? '#,##0' : '0.00';
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
        });
        [1, 3].forEach((si) => {
          totalRow.getCell(startCol + si).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' },
          };
        });
      }
      totalRow.height = 22;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="suivi-hebdo-${today}.xlsx"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
