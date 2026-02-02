/**
 * Génère les JSON de `data/` à partir des CSV dans `data/exemple/`.
 *
 * Objectif:
 * - Aligner les données locales sur le même modèle que Google Sheets / CSV:
 *   Matiere -> Category -> Theme (porte le Level) -> Questions
 * - Permettre au projet de rester cohérent avec l'architecture "exemple"
 *
 * Usage:
 *   node scripts/build-data-from-example.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXEMPLE_DIR = path.join(ROOT, 'data', 'exemple');
const DATA_DIR = path.join(ROOT, 'data');

function fail(msg) {
  console.error(`[build-data-from-example] ${msg}`);
  process.exit(1);
}

function readText(p) {
  return fs.readFileSync(p, 'utf-8');
}

function writeJson(relPath, value) {
  const outPath = path.join(ROOT, relPath);
  fs.writeFileSync(outPath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

/**
 * Parseur CSV robuste (gère quotes, virgules dans quotes, CRLF).
 * Retourne un tableau de lignes, chacune étant un tableau de cellules.
 */
function parseCsvToRows(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;

  // Normaliser fins de ligne
  const s = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          // quote échappé
          cell += '"';
          i += 2;
          continue;
        }
        // fin de champ quoted
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    // hors quotes
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }

    if (ch === '\n') {
      row.push(cell);
      cell = '';
      // ignorer lignes totalement vides
      const isEmptyRow = row.every(v => !String(v ?? '').trim());
      if (!isEmptyRow) rows.push(row);
      row = [];
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  // dernière cellule / ligne
  row.push(cell);
  const isEmptyRow = row.every(v => !String(v ?? '').trim());
  if (!isEmptyRow) rows.push(row);

  if (inQuotes) {
    fail('CSV invalide: guillemets non fermés');
  }

  return rows;
}

function parseCsvToObjects(csv) {
  const rows = parseCsvToRows(csv);
  if (!rows.length) return [];
  const header = rows[0].map(h => String(h || '').trim());
  const out = [];
  for (const r of rows.slice(1)) {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      obj[key] = r[i] === undefined ? '' : r[i];
    }
    out.push(obj);
  }
  return out;
}

function findExempleFile(kind) {
  // Ex: " - Category.csv"
  const files = fs.readdirSync(EXEMPLE_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  const suffix = ` - ${kind}.csv`.toLowerCase();
  return (
    files.find(f => f.toLowerCase().endsWith(suffix)) ||
    files.find(f => f.toLowerCase().endsWith(`${kind.toLowerCase()}.csv`))
  );
}

function asStr(v) {
  return String(v ?? '').trim();
}

function uniqSortedInts(values) {
  const s = new Set();
  for (const v of values) {
    const n = parseInt(String(v).trim(), 10);
    if (!Number.isNaN(n)) s.add(n);
  }
  return Array.from(s).sort((a, b) => a - b);
}

function main() {
  if (!fs.existsSync(EXEMPLE_DIR)) {
    fail(`Dossier introuvable: ${EXEMPLE_DIR}`);
  }
  if (!fs.existsSync(DATA_DIR)) {
    fail(`Dossier introuvable: ${DATA_DIR}`);
  }

  const fCategory = findExempleFile('Category');
  const fLevel = findExempleFile('Level');
  const fMatiere = findExempleFile('Matiere');
  const fTheme = findExempleFile('Theme');
  const fQuestions = findExempleFile('Questions');

  if (!fCategory || !fLevel || !fMatiere || !fTheme || !fQuestions) {
    fail(
      `CSV manquants. Requis: Category/Level/Matiere/Theme/Questions. Trouvés: ${[
        fCategory,
        fLevel,
        fMatiere,
        fTheme,
        fQuestions
      ].filter(Boolean).join(', ')}`
    );
  }

  const categoriesRows = parseCsvToObjects(readText(path.join(EXEMPLE_DIR, fCategory)));
  const levelsRows = parseCsvToObjects(readText(path.join(EXEMPLE_DIR, fLevel)));
  const matieresRows = parseCsvToObjects(readText(path.join(EXEMPLE_DIR, fMatiere)));
  const themesRows = parseCsvToObjects(readText(path.join(EXEMPLE_DIR, fTheme)));
  const questionsRows = parseCsvToObjects(readText(path.join(EXEMPLE_DIR, fQuestions)));

  const levels = levelsRows.map(r => ({
    id: asStr(r.ID),
    name: asStr(r.Libel)
  })).filter(l => l.id && l.name);

  const categories = categoriesRows.map(r => ({
    id: asStr(r.ID),
    name: asStr(r.Name),
    startDate: asStr(r.Start_Date),
    endDate: asStr(r.End_Date),
    idMatiere: asStr(r.IDMatiere)
  })).filter(c => c.id && c.name && c.idMatiere);

  const themes = themesRows.map(r => ({
    id: asStr(r.ID),
    idCategory: asStr(r.IDCategory),
    idLevel: asStr(r.IDLevel),
    name: asStr(r.Name),
    description: asStr(r.Description)
  })).filter(t => t.id && t.idCategory && t.idLevel && t.name);

  // Questions au format "table" (proche CSV / Sheets)
  const questions = questionsRows.map((r, idx) => ({
    id: asStr(r.ID) || String(idx + 1),
    idTheme: asStr(r.IDTheme),
    question: asStr(r.Question),
    rightAnswer: asStr(r.Right_Answer),
    proposition1: asStr(r.Proposition1),
    proposition2: asStr(r.Proposition2),
    proposition3: asStr(r.Proposition3),
    explication: asStr(r.Explications),
    typeQuestion: asStr(r.Type_Question) || 'QCM'
  })).filter(q => q.id && q.idTheme && q.question);

  // Matières (MLD): Matiere = (ID, Nom)
  const matieres = matieresRows.map(r => ({
    id: asStr(r.ID),
    name: asStr(r.Nom)
  })).filter(m => m.id && m.name);

  // Écriture des JSON
  writeJson('data/levels.json', levels);
  writeJson('data/matieres.json', matieres);
  writeJson('data/categories.json', categories);
  writeJson('data/themes.json', themes);
  writeJson('data/questions.json', questions);

  console.log('[build-data-from-example] OK');
  console.log(`- levels: ${levels.length}`);
  console.log(`- matieres: ${matieres.length}`);
  console.log(`- categories: ${categories.length}`);
  console.log(`- themes: ${themes.length}`);
  console.log(`- questions: ${questions.length}`);
}

main();

