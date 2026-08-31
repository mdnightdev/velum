import { theme } from './theme.js';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'right';
  format?: (val: any, row: T) => string;
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  if (maxLen <= 1) return str.substring(0, maxLen);
  return str.substring(0, maxLen - 1) + '…';
}

export function printTable<T extends Record<string, any>>(
  rows: T[],
  columnDefs?: (TableColumn<T> | string)[]
): void {
  if (!rows || rows.length === 0) {
    return;
  }

  // Normalize column definitions
  const cols: TableColumn<T>[] = [];
  if (columnDefs && columnDefs.length > 0) {
    for (const c of columnDefs) {
      if (typeof c === 'string') {
        cols.push({ key: c, header: c.toUpperCase() });
      } else {
        cols.push(c);
      }
    }
  } else {
    const keys = Object.keys(rows[0] || {});
    for (const k of keys) {
      cols.push({ key: k, header: k.toUpperCase() });
    }
  }

  if (cols.length === 0) return;

  const termWidth = Math.max(40, (process.stdout.columns || 80) - 2);

  // Measure content lengths
  const formattedRows: Record<string, string>[] = [];
  const measuredLengths: Record<string, number> = {};

  for (const c of cols) {
    measuredLengths[c.key] = c.header.length;
  }

  for (const row of rows) {
    const fRow: Record<string, string> = {};
    for (const c of cols) {
      const rawVal = row[c.key];
      const valStr = c.format
        ? c.format(rawVal, row)
        : rawVal === null || rawVal === undefined
        ? '-'
        : typeof rawVal === 'object' && rawVal instanceof Date
        ? rawVal.toISOString().split('T')[0]
        : String(rawVal);
      fRow[c.key] = valStr;
      if (valStr.length > (measuredLengths[c.key] || 0)) {
        measuredLengths[c.key] = valStr.length;
      }
    }
    formattedRows.push(fRow);
  }

  // Border overhead: 1 char left/right border, plus 3 chars per column (2 spaces + 1 divider)
  const borderOverhead = 1 + cols.length * 3;
  const availableContentWidth = Math.max(cols.length * 3, termWidth - borderOverhead);

  // Calculate allocated widths
  let sumMeasured = cols.reduce((acc, c) => acc + (measuredLengths[c.key] || c.header.length), 0);
  const allocatedWidths: Record<string, number> = {};

  if (sumMeasured <= availableContentWidth) {
    for (const c of cols) {
      allocatedWidths[c.key] = measuredLengths[c.key] || c.header.length;
    }
  } else {
    const minPerCol = 3;
    let remainingBudget = availableContentWidth;
    
    // First pass: allocate min widths
    for (const c of cols) {
      const minW = c.minWidth || minPerCol;
      allocatedWidths[c.key] = Math.min(measuredLengths[c.key] || c.header.length, minW);
      remainingBudget -= allocatedWidths[c.key];
    }

    // Second pass: distribute remaining budget proportionally
    if (remainingBudget > 0) {
      const extraNeeded = sumMeasured - cols.reduce((acc, c) => acc + allocatedWidths[c.key], 0);
      if (extraNeeded > 0) {
        for (const c of cols) {
          const needed = (measuredLengths[c.key] || c.header.length) - allocatedWidths[c.key];
          const extra = Math.min(needed, Math.floor((needed / extraNeeded) * remainingBudget));
          allocatedWidths[c.key] += extra;
        }
      }
    }
  }

  // Draw Top Border: ┌──────┬──────────┐
  const topSegments = cols.map(c => '─'.repeat(allocatedWidths[c.key] + 2));
  console.log(`${theme.dim}┌${topSegments.join('┬')}┐${theme.reset}`);

  // Draw Header: │ ID   │ USERNAME │
  const headerCells = cols.map(c => {
    const w = allocatedWidths[c.key];
    const text = truncateString(c.header, w);
    const padded = c.align === 'right' ? text.padStart(w) : text.padEnd(w);
    return ` ${theme.boldWhite}${padded}${theme.reset} `;
  });
  console.log(`${theme.dim}│${theme.reset}${headerCells.join(`${theme.dim}│${theme.reset}`)}${theme.dim}│${theme.reset}`);

  // Draw Middle Divider: ├──────┼──────────┤
  const midSegments = cols.map(c => '─'.repeat(allocatedWidths[c.key] + 2));
  console.log(`${theme.dim}├${midSegments.join('┼')}┤${theme.reset}`);

  // Draw Data Rows: │ 1    │ midnight │
  for (const fRow of formattedRows) {
    const rowCells = cols.map(c => {
      const w = allocatedWidths[c.key];
      const text = truncateString(fRow[c.key] || '', w);
      const padded = c.align === 'right' ? text.padStart(w) : text.padEnd(w);
      return ` ${padded} `;
    });
    console.log(`${theme.dim}│${theme.reset}${rowCells.join(`${theme.dim}│${theme.reset}`)}${theme.dim}│${theme.reset}`);
  }

  // Draw Bottom Border: └──────┴──────────┘
  const botSegments = cols.map(c => '─'.repeat(allocatedWidths[c.key] + 2));
  console.log(`${theme.dim}└${botSegments.join('┴')}┘${theme.reset}`);
}

export function printDetail(title: string, fields: Record<string, any>): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const maxKeyLen = Math.max(...keys.map(k => k.length));
  for (const k of keys) {
    const val = fields[k];
    const displayVal = val === null || val === undefined || val === ''
      ? '-'
      : (val instanceof Date ? val.toISOString() : String(val));
    console.log(`  ${theme.dim}${k.padEnd(maxKeyLen)}${theme.reset} : ${displayVal}`);
  }
}

export function printGrid(items: string[], maxCols = 5, minColWidth = 16): void {
  if (!items || items.length === 0) return;
  const termWidth = Math.max(40, (process.stdout.columns || 80) - 4);
  const longest = Math.max(...items.map(i => i.length), 8);
  const colWidth = Math.max(minColWidth, longest + 4);
  const responsiveCols = Math.max(1, Math.min(maxCols, Math.floor(termWidth / colWidth)));
  const actualColWidth = Math.floor(termWidth / responsiveCols);

  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += responsiveCols) {
    rows.push(items.slice(i, i + responsiveCols));
  }
  rows.forEach(row => {
    const padded = row.map(item => item.padEnd(actualColWidth));
    console.log(`  ${theme.white}${padded.join('')}${theme.reset}`);
  });
}
