import ExcelJS from 'exceljs';

export type TenderSpreadsheetRow = string[];

const excelExtensions = new Set(['xlsx']);
const textExtensions = new Set(['csv', 'txt']);

export async function readTenderSpreadsheetRows(file: File): Promise<TenderSpreadsheetRow[]> {
  const extension = fileExtension(file.name);
  if (textExtensions.has(extension)) {
    return parseCsvText(await readFileText(file));
  }
  if (excelExtensions.has(extension)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await readFileArrayBuffer(file)) as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.worksheets[0];
    return worksheet ? normalizeRows(readWorksheetRows(worksheet)) : [];
  }
  throw new Error('Use a .xlsx, .csv, or .txt file for this import.');
}

function readFileText(file: File) {
  if (typeof file.text === 'function') return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

function readFileArrayBuffer(file: File) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('This file could not be read.'));
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadTenderSpreadsheetTemplate(fileName: string, rows: TenderSpreadsheetRow[], columnWidths?: Array<{ wch: number }>) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Template');
  rows.forEach((row) => worksheet.addRow(row));
  if (columnWidths?.length) {
    worksheet.columns = columnWidths.map((column) => ({ width: column.wch }));
  }
  const data = await workbook.xlsx.writeBuffer();
  const blob = new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function fileExtension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function readWorksheetRows(worksheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  const columnCount = worksheet.columnCount;
  worksheet.eachRow((row) => {
    const values: unknown[] = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      values.push(readCellValue(row.getCell(columnIndex).value));
    }
    rows.push(values);
  });
  return rows;
}

function readCellValue(value: ExcelJS.CellValue): unknown {
  if (!value || value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if ('text' in value && value.text !== undefined) return value.text;
  if ('result' in value && value.result !== undefined) return readCellValue(value.result as ExcelJS.CellValue);
  if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? '').join('');
  if ('formula' in value && value.formula !== undefined) return value.result ?? '';
  return '';
}

function parseCsvText(text: string): TenderSpreadsheetRow[] {
  return normalizeRows(
    text
      .split(/\r?\n/)
      .map((line) => parseCsvLine(line))
  );
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ''));
}

function normalizeRows(rows: unknown[][]): TenderSpreadsheetRow[] {
  return rows
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean));
}
