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

  // Detect terminal column width (fallback to 80 on desktop/PWA or standard terminals)
  const termWidth = process.stdout.columns || 80;
  const isCompact = termWidth < 80;

  // Calculate maximum content widths per column with responsive limits
  const calculatedWidths = columns.map((c) => {
    if (c.width && !isCompact) return c.width;
    const maxContentLen = Math.max(
      c.label.length,
      ...data.map((d) => String(d[c.key] ?? '-').length)
    );
    // On small/mobile screens, cap individual columns to avoid border wrapping
    const maxWidthCap = isCompact ? Math.max(6, Math.floor(termWidth / columns.length) - 3) : 40;
    return Math.min(maxWidthCap, Math.max(c.label.length, maxContentLen));
  });

  const header = columns
    .map((c, i) => c.label.substring(0, calculatedWidths[i]).padEnd(calculatedWidths[i]))
    .join(' │ ');
  const separator = calculatedWidths.map((w) => '─'.repeat(w)).join('─┼─');

  console.log(`┌─${calculatedWidths.map((w) => '─'.repeat(w)).join('─┬─')}─┐`);
  console.log(`│ ${header} │`);
  console.log(`├─${separator}─┤`);

  for (const row of data) {
    const line = columns
      .map((c, i) => {
        const val = String(row[c.key] ?? '-');
        const maxW = calculatedWidths[i];
        const truncated = val.length > maxW ? val.substring(0, maxW - 1) + '…' : val;
        return truncated.padEnd(maxW);
      })
      .join(' │ ');
    console.log(`│ ${line} │`);
  }

  console.log(`└─${calculatedWidths.map((w) => '─'.repeat(w)).join('─┴─')}─┘`);
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
