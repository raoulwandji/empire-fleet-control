import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';
import { Column } from '@/lib/export';

const COMPANY_NAME = 'EMPIRE-FLEET CONTROL';

// Logo chargé une seule fois (fichier local, ne change pas en cours d'exécution).
let cachedLogoDataUri: string | null | undefined;
function getLogoDataUri(): string | null {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    const buffer = fs.readFileSync(logoPath);
    cachedLogoDataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    cachedLogoDataUri = null;
  }
  return cachedLogoDataUri;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 4 },
  headerText: { flexDirection: 'column' },
  companyName: { fontSize: 13, fontWeight: 'bold', color: '#181210' },
  title: { fontSize: 11, marginTop: 2, color: '#b3122a', fontWeight: 'bold' },
  table: { display: 'flex', width: '100%' },
  row: { flexDirection: 'row', borderBottom: '1px solid #ddd' },
  headerRow: { flexDirection: 'row', backgroundColor: '#181210', paddingVertical: 4 },
  headerCell: { color: 'white', fontWeight: 'bold', paddingHorizontal: 4, flex: 1 },
  cell: { paddingHorizontal: 4, paddingVertical: 3, flex: 1 },
});

function TablePdf({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Column[];
  rows: Record<string, unknown>[];
}) {
  const logo = getLogoDataUri();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          {logo && <Image src={logo} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.companyName}>{COMPANY_NAME}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {columns.map((c) => (
              <Text key={c.key} style={styles.headerCell}>
                {c.header}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View style={styles.row} key={i}>
              {columns.map((c) => (
                <Text key={c.key} style={styles.cell}>
                  {String(row[c.key] ?? '')}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function buildPdfBuffer(
  title: string,
  columns: Column[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  return renderToBuffer(<TablePdf title={title} columns={columns} rows={rows} />);
}
