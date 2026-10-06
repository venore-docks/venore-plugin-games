// CSV mínimo, sem dependência — vírgula ou ponto e vírgula (Excel em pt-BR salva com ";"), campo
// entre aspas (com vírgula/quebra de linha dentro), "" escapando aspas, CRLF ou LF, BOM do Excel.
// Base: parser do plugin Erasto League.

function detectDelimiter(firstLine: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ",") commas += 1;
    else if (!inQuotes && char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(input.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Sem acento, minúsculo, espaços colapsados — casa "3º Ano A" com "3º ano a" e "Pátio" com "patio".
export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

export type CsvRow = { line: number; cells: Record<string, string> };

// Linhas → objetos casados pelo cabeçalho (normalizado: "Home Team Id" = "hometeamid"). Linhas
// vazias somem; `line` é a linha do arquivo (pra mensagem de erro).
export function csvToRows(text: string): CsvRow[] {
  const [header, ...rest] = parseCsv(text);
  if (!header) return [];
  const columns = header.map(normalizeHeader);
  const rows: CsvRow[] = [];
  rest.forEach((cells, index) => {
    if (!cells.some((cell) => cell.trim().length > 0)) return;
    rows.push({ line: index + 2, cells: Object.fromEntries(columns.map((column, i) => [column, (cells[i] ?? "").trim()])) });
  });
  return rows;
}

// Primeira coluna preenchida entre os apelidos aceitos (inglês do plugin antigo + português).
export function pickCell(row: CsvRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row.cells[normalizeHeader(alias)];
    if (value) return value;
  }
  return "";
}

// "dd/mm/aaaa" (formato das artes) ou "aaaa-mm-dd"; hora "HH:mm" opcional. Data inválida = null
// (jogo "a definir"); nada de fuso aqui — data e hora são texto puro no banco.
export function parseFlexibleDate(dateRaw: string, timeRaw: string): { scheduledDate: string | null; scheduledTime: string | null; valid: boolean } {
  const date = dateRaw.trim();
  if (!date) return { scheduledDate: null, scheduledTime: null, valid: true };
  const br = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const parts = br ? { day: +br[1], month: +br[2], year: +br[3] } : iso ? { day: +iso[3], month: +iso[2], year: +iso[1] } : null;
  if (!parts) return { scheduledDate: null, scheduledTime: null, valid: false };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() !== parts.month - 1 || check.getUTCDate() !== parts.day) {
    return { scheduledDate: null, scheduledTime: null, valid: false };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = timeRaw.trim().match(/^(\d{1,2})[:h](\d{2})/);
  const hours = time ? Number(time[1]) : null;
  const minutes = time ? Number(time[2]) : null;
  const scheduledTime = hours !== null && minutes !== null && hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
  return { scheduledDate: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`, scheduledTime, valid: timeRaw.trim() === "" || scheduledTime !== null };
}
