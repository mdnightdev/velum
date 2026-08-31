export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export function formatTable(
  data: Record<string, any>[],
  columns: TableColumn[]
): void {
  if (data.length === 0) {
    console.log('No records found.');
    return;
  }

  // Calculate clean column widths based on longest value + 2 space gap
  const widths = columns.map((c) => {
    const maxVal = Math.max(
      c.label.length,
      ...data.map((d) => String(d[c.key] ?? '-').length)
    );
    return Math.max(c.width || 0, maxVal);
  });

  // Standard Unix header (e.g. ps aux / docker ps)
  const header = columns
    .map((c, i) => c.label.toUpperCase().padEnd(widths[i]))
    .join('  ');
  console.log(header);

  // Standard Unix rows
  for (const row of data) {
    const line = columns
      .map((c, i) => {
        const val = String(row[c.key] ?? '-');
        return val.padEnd(widths[i]);
      })
      .join('  ');
    console.log(line);
  }
}

export function printDetail(title: string, fields: Record<string, any>): void {
  console.log(`\n=== ${title} ===`);
  const keys = Object.keys(fields);
  const maxKeyLen = Math.max(...keys.map((k) => k.length), 0);
  for (const k of keys) {
    const val = fields[k];
    const displayVal =
      val === null || val === undefined || val === ''
        ? '-'
        : val instanceof Date
        ? val.toISOString()
        : String(val);
    console.log(`  ${k.padEnd(maxKeyLen)} : ${displayVal}`);
  }
}
