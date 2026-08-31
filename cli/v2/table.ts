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

  const termWidth = process.stdout.columns || 80;

  // Calculate maximum content widths per column, respecting terminal limits
  const calculatedWidths = columns.map((c) => {
    const maxContentLen = Math.max(
      c.label.length,
      ...data.map((d) => String(d[c.key] ?? '-').length)
    );
    const configuredWidth = c.width || maxContentLen;
    return Math.max(c.label.length, Math.min(configuredWidth, maxContentLen));
  });

  const totalWidth = calculatedWidths.reduce((sum, w) => sum + w, 0) + (columns.length - 1) * 3 + 4;
  
  // If table exceeds terminal width, scale down largest columns
  if (totalWidth > termWidth && termWidth > 40) {
    const overflow = totalWidth - termWidth;
    let reducibleCols = calculatedWidths.filter(w => w > 10).length || 1;
    const reductionPerCol = Math.ceil(overflow / reducibleCols);
    for (let i = 0; i < calculatedWidths.length; i++) {
      if (calculatedWidths[i] > 10) {
        calculatedWidths[i] = Math.max(8, calculatedWidths[i] - reductionPerCol);
      }
    }
  }

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
