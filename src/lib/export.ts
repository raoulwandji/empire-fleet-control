import ExcelJS from 'exceljs';
import path from 'path';

export type Column = { header: string; key: string; width?: number };

const COMPANY_NAME = 'EMPIRE-FLEET CONTROL';

export async function buildExcelBuffer(
  sheetName: string,
  columns: Column[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Largeurs de colonnes uniquement — l'en-tête du tableau est écrit manuellement
  // plus bas pour laisser la place au bandeau logo + nom d'entreprise.
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 20 }));

  // Bandeau d'en-tête : logo + identité de l'entreprise.
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    const imageId = workbook.addImage({ filename: logoPath, extension: 'jpeg' });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 48, height: 48 } });
  } catch {
    // Logo optionnel : le rapport reste valide sans lui.
  }

  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 16;
  sheet.mergeCells(1, 2, 1, Math.max(columns.length, 3));
  sheet.getCell(1, 2).value = COMPANY_NAME;
  sheet.getCell(1, 2).font = { bold: true, size: 14, color: { argb: 'FFB3122A' } };
  sheet.mergeCells(2, 2, 2, Math.max(columns.length, 3));
  sheet.getCell(2, 2).value = sheetName;
  sheet.getCell(2, 2).font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headerRow = sheet.getRow(4);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF181210' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  rows.forEach((row) => {
    sheet.addRow(columns.map((c) => row[c.key] ?? ''));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
