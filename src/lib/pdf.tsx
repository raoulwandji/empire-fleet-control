import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { Column } from '@/lib/export';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9 },
  title: { fontSize: 14, marginBottom: 10, color: '#b3122a', fontWeight: 'bold' },
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
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
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
