/**
 * Minimal dependency-free PDF writer for tabular statements.
 *
 * Text only, built-in Helvetica (no font embedding), A4, automatic page
 * breaks with the table header repeated. It exists so statements can be
 * exported without adding a PDF dependency; if the project later adopts
 * pdfkit, only this file needs replacing (buildStatementPdf keeps its shape).
 */

const PAGE = { w: 595.28, h: 841.89, margin: 40 };

// Helvetica advance widths (per 1000 em) for the characters that matter for
// right-aligning money; everything else uses a sensible average.
const widthOf = (ch) => {
  if (ch >= '0' && ch <= '9') return 556;
  if (ch === ',' || ch === '.' || ch === ' ' || ch === ':' || ch === ';') return 278;
  if (ch === '-' || ch === '(' || ch === ')') return 333;
  if (ch >= 'A' && ch <= 'Z') return 667;
  if ('ilj'.includes(ch)) return 222;
  if ('mw'.includes(ch)) return 778;
  return 520;
};
export const textWidth = (text, size) =>
  ([...String(text)].reduce((a, ch) => a + widthOf(ch), 0) * size) / 1000;

// Standard fonts only cover Latin-1: swap anything else for '?' rather than
// emit bytes that render as garbage.
const clean = (s) =>
  String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const fit = (text, maxWidth, size) => {
  let t = String(text ?? '');
  if (textWidth(t, size) <= maxWidth) return t;
  while (t.length > 1 && textWidth(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
};

/**
 * doc = {
 *   title, subtitle?, meta?: [[label, value], ...],
 *   sections: [{ heading, columns: [{ key, label, width, align? }], rows: [{...}], totalsRow? }],
 *   footer?
 * }
 * Column widths are relative weights; they are scaled to the printable width.
 */
export const buildPdf = (doc) => {
  const pages = [[]];
  let y = PAGE.h - PAGE.margin;
  const usable = PAGE.w - PAGE.margin * 2;
  const cur = () => pages[pages.length - 1];

  const text = (str, x, yy, size = 9, bold = false) =>
    cur().push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${clean(str)}) Tj ET`);
  const rule = (yy, gray = 0.75) =>
    cur().push(`${gray} G 0.5 w ${PAGE.margin} ${yy.toFixed(2)} m ${PAGE.w - PAGE.margin} ${yy.toFixed(2)} l S 0 G`);
  const newPage = () => {
    pages.push([]);
    y = PAGE.h - PAGE.margin;
  };
  const need = (h) => {
    if (y - h < PAGE.margin + 20) newPage();
  };

  text(doc.title, PAGE.margin, y - 14, 16, true);
  y -= 24;
  if (doc.subtitle) {
    text(doc.subtitle, PAGE.margin, y - 10, 10);
    y -= 16;
  }
  for (const [label, value] of doc.meta || []) {
    text(`${label}:`, PAGE.margin, y - 9, 9, true);
    text(String(value ?? ''), PAGE.margin + 90, y - 9, 9);
    y -= 13;
  }
  y -= 6;

  for (const section of doc.sections || []) {
    need(60);
    if (section.heading) {
      text(section.heading, PAGE.margin, y - 11, 11, true);
      y -= 20;
    }
    const total = section.columns.reduce((a, c) => a + c.width, 0);
    let x = PAGE.margin;
    const cols = section.columns.map((c) => {
      const w = (c.width / total) * usable;
      const col = { ...c, x, w };
      x += w;
      return col;
    });

    const header = () => {
      for (const c of cols) {
        const label = fit(c.label, c.w - 6, 8);
        const lx = c.align === 'right' ? c.x + c.w - 4 - textWidth(label, 8) : c.x + 2;
        text(label, lx, y - 8, 8, true);
      }
      y -= 12;
      rule(y);
      y -= 4;
    };
    const drawRow = (row, bold = false) => {
      for (const c of cols) {
        const val = fit(row[c.key] ?? '', c.w - 6, 8.5);
        const lx = c.align === 'right' ? c.x + c.w - 4 - textWidth(val, 8.5) : c.x + 2;
        text(val, lx, y - 8, 8.5, bold);
      }
      y -= 13;
    };

    header();
    if (!section.rows.length) {
      text(section.emptyText || 'Nothing to show.', PAGE.margin + 2, y - 8, 8.5);
      y -= 16;
    }
    for (const row of section.rows) {
      if (y - 13 < PAGE.margin + 20) {
        newPage();
        header();
      }
      drawRow(row);
    }
    if (section.totalsRow) {
      need(20);
      rule(y + 2, 0.4);
      drawRow(section.totalsRow, true);
    }
    y -= 12;
  }

  // Assemble objects: 1 catalog, 2 pages, 3 F1, 4 F2, then page/content pairs.
  const objs = [];
  const add = (body) => objs.push(body) && objs.length;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // patched below once page ids are known
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageIds = [];
  pages.forEach((ops, i) => {
    const footer = `${doc.footer || ''}${doc.footer ? '   |   ' : ''}Page ${i + 1} of ${pages.length}`;
    const stream = [
      ...ops,
      `BT /F1 7.5 Tf ${PAGE.margin} 24 Td (${clean(footer)}) Tj ET`,
    ].join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
};

export default { buildPdf, textWidth };
