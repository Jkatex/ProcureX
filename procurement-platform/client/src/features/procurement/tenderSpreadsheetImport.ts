import * as XLSX from 'xlsx';

export type TenderSpreadsheetRow = string[];

const excelExtensions = new Set(['xlsx', 'xls']);
const textExtensions = new Set(['csv', 'txt']);

export async function readTenderSpreadsheetRows(file: File): Promise<TenderSpreadsheetRow[]> {
  const extension = fileExtension(file.name);
  if (textExtensions.has(extension)) {
    return parseCsvText(await readFileText(file));
  }
  if (excelExtensions.has(extension)) {
    const workbook = XLSX.read(await readFileArrayBuffer(file), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '' });
    return normalizeRows(rows);
  }
  throw new Error('Use an Excel or CSV file for this import.');
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

export function downloadTenderSpreadsheetTemplate(fileName: string, rows: TenderSpreadsheetRow[]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
