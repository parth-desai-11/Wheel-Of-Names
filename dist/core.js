export const TAU = Math.PI * 2;
export const MAX_ENTRIES = 1000;

export function normalizedChances(entries) {
  // Scale first to keep even very large finite weights from overflowing.
  const max = Math.max(0, ...entries.map(entry => entry.weight));
  if (!max) return entries.map(() => 0);
  const scaled = entries.map(entry => entry.weight / max);
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  return scaled.map(weight => weight / total);
}

export function pickWeightedIndex(entries, randomValue) {
  if (!(randomValue >= 0 && randomValue < 1)) throw new Error('Random value must be in [0, 1).');
  const chances = normalizedChances(entries);
  let cumulative = 0;
  let lastEligible = -1;
  for (let index = 0; index < chances.length; index++) {
    if (chances[index] <= 0) continue;
    lastEligible = index;
    cumulative += chances[index];
    if (randomValue < cumulative) return index;
  }
  if (lastEligible < 0) throw new Error('Give at least one entry a weight greater than zero.');
  return lastEligible;
}

export function rotationForWinner(index, count, currentRotation, randomValue = 0.5, turns = 6) {
  const slice = TAU / count;
  const offset = 0.2 + randomValue * 0.6;
  const target = (TAU - (index + offset) * slice) % TAU;
  const current = ((currentRotation % TAU) + TAU) % TAU;
  return currentRotation + turns * TAU + (target - current + TAU) % TAU;
}

export function indexAtPointer(rotation, count) {
  const position = ((-rotation % TAU) + TAU) % TAU;
  return Math.min(count - 1, Math.floor(position / (TAU / count)));
}

function delimiterFor(text) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === '\n' || char === '\r') break;
      if (char in counts) counts[char]++;
    }
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const delimiter = delimiterFor(text);
  const rows = [];
  let row = [], field = '', quoted = false, closedQuote = false;
  const pushField = () => { row.push(field.trim()); field = ''; closedQuote = false; };
  const pushRow = () => { pushField(); if (row.some(cell => cell !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === delimiter) pushField();
    else if (char === '\r' || char === '\n') {
      pushRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else if (char === '"' && !field.trim() && !closedQuote) { field = ''; quoted = true; }
    else if (closedQuote && char.trim()) throw new Error('Unexpected text after a closing quote. Check your CSV.');
    else field += char;
  }
  if (quoted) throw new Error('A quoted field is missing its closing quote.');
  pushRow();
  if (!rows.length) throw new Error('Add at least one name to import.');
  const headers = rows[0].map(cell => cell.toLowerCase());
  const nameColumn = headers.findIndex(cell => ['name', 'names', 'entry', 'entries', 'label'].includes(cell));
  const weightColumn = headers.findIndex(cell => ['weight', 'weights', 'probability', 'chance', 'probability (%)', 'chance (%)'].includes(cell));
  const hasHeader = nameColumn >= 0 && (weightColumn >= 0 || rows[0].length === 1);
  const data = hasHeader ? rows.slice(1) : rows;
  if (!data.length) throw new Error('Your CSV has a header but no entries.');
  if (data.length > MAX_ENTRIES) throw new Error(`Import up to ${MAX_ENTRIES.toLocaleString()} entries at a time.`);
  return data.map((cells, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const name = cells[hasHeader ? nameColumn : 0]?.trim();
    if (!name) throw new Error(`Row ${line}: a name is missing.`);
    if (name.length > 120) throw new Error(`Row ${line}: keep names under 121 characters.`);
    if (!hasHeader && cells.length > 2) throw new Error(`Row ${line}: use two columns (name, weight), or include a header.`);
    const raw = cells[hasHeader ? weightColumn : 1] ?? '';
    const cleaned = raw.replace(/%$/, '').trim();
    const weight = cleaned === '' ? 1 : Number(cleaned);
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`Row ${line}: weights must be finite numbers of zero or more.`);
    return { name, weight };
  });
}

export function exportCSV(entries) {
  return 'name,weight\r\n' + entries.map(entry => `"${entry.name.replaceAll('"', '""')}",${entry.weight}`).join('\r\n');
}
