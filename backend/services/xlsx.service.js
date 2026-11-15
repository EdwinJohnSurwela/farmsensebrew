/**
 * Small Excel (.xlsx) writer for letterhead reports. No extra npm packages:
 * the workbook XML is written here and zipped with Node's own zlib, so the
 * Pi builds the file offline, like the PDF.
 *
 * buildReport({ title, lines, columns, rows, logoPng, barPng, footer, sheetName })
 *   columns: [{ header, width, type: 'text'|'number'|'date', format?, color?(value) }]
 *   rows:    arrays of cell values in column order (Date for 'date' columns)
 * The sheet: farm letterhead on top, then the report title and notes, then the
 * table with a frozen, filterable header row. Printing fits the width, repeats
 * the header row, and puts the tagline and page numbers in the footer.
 */
const zlib = require("zlib");
const { FARM, COLORS } = require("./letterhead.service");

// ─── zip (store + deflate) ─────────────────────────────────────────────
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

function zip(files) {
  const now = dosTime(new Date());
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const packed = zlib.deflateRawSync(raw, { level: 6 });
    const crc = zlib.crc32(raw);
    const nameBuf = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0x0800, 6);        // UTF-8 names
    local.writeUInt16LE(8, 8);             // deflate
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, packed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);               // version made by
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(now.time, 12);
    cd.writeUInt16LE(now.date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(packed.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

// ─── helpers ───────────────────────────────────────────────────────────
const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // characters XML 1.0 does not allow
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const argb = (hex) => "FF" + hex.replace("#", "").toUpperCase();

function colName(i) {           // 0 -> A, 25 -> Z, 26 -> AA
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Excel date serial for a moment, shown in Philippine time (UTC+8, no daylight saving). */
function phSerial(d) {
  return (new Date(d).getTime() + 8 * 3600000) / 86400000 + 25569;
}

// ─── styles ────────────────────────────────────────────────────────────
// Every style the sheet uses, by name -> index in cellXfs.
const FONT = {
  body: `<font><sz val="10"/><color rgb="${argb(COLORS.body)}"/><name val="Arial"/><family val="2"/></font>`,
  farm: `<font><b/><sz val="16"/><color rgb="${argb(COLORS.title)}"/><name val="Arial"/><family val="2"/></font>`,
  sub: `<font><sz val="10"/><color rgb="${argb(COLORS.subtitle)}"/><name val="Arial"/><family val="2"/></font>`,
  muted: `<font><sz val="9"/><color rgb="${argb(COLORS.muted)}"/><name val="Arial"/><family val="2"/></font>`,
  title: `<font><b/><sz val="14"/><color rgb="${argb(COLORS.title)}"/><name val="Arial"/><family val="2"/></font>`,
  head: `<font><b/><sz val="10"/><color rgb="${argb(COLORS.title)}"/><name val="Arial"/><family val="2"/></font>`,
  crit: `<font><b/><sz val="10"/><color rgb="FFA8322A"/><name val="Arial"/><family val="2"/></font>`,
  high: `<font><b/><sz val="10"/><color rgb="FFC4561C"/><name val="Arial"/><family val="2"/></font>`,
  mod: `<font><b/><sz val="10"/><color rgb="FFA36B10"/><name val="Arial"/><family val="2"/></font>`,
  low: `<font><sz val="10"/><color rgb="FF6F7D1E"/><name val="Arial"/><family val="2"/></font>`,
  min: `<font><sz val="10"/><color rgb="FF2F6B3A"/><name val="Arial"/><family val="2"/></font>`,
};
const FONT_IDS = Object.fromEntries(Object.keys(FONT).map((k, i) => [k, i]));
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  `<fill><patternFill patternType="solid"><fgColor rgb="${argb(COLORS.page)}"/><bgColor indexed="64"/></patternFill></fill>`, // 2 page
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EFE3"/><bgColor indexed="64"/></patternFill></fill>',            // 3 header
];
const BORDERS = [
  "<border><left/><right/><top/><bottom/><diagonal/></border>",
  `<border><left/><right/><top/><bottom style="thin"><color rgb="${argb(COLORS.rule)}"/></bottom><diagonal/></border>`, // 1 rule
  `<border><left/><right/><top/><bottom style="medium"><color rgb="${argb(COLORS.accent)}"/></bottom><diagonal/></border>`, // 2 header
];
// custom number formats start at 164
const NUMFMTS = { "0.0": 164, "yyyy-mm-dd h:mm:ss AM/PM": 165, "0": 1, "General": 0 };

const xfs = [];      // cellXfs entries (XML)
const xfIndex = {};  // key -> index
function xf(key, { font = "body", fill = 0, border = 0, numFmt = 0, align = null } = {}) {
  if (xfIndex[key] !== undefined) return xfIndex[key];
  const a = align ? `<alignment ${align}/>` : "";
  xfs.push(`<xf numFmtId="${numFmt}" fontId="${FONT_IDS[font]}" fillId="${fill}" borderId="${border}" xfId="0"`
    + `${numFmt ? ' applyNumberFormat="1"' : ""} applyFont="1"${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}`
    + `${a ? ' applyAlignment="1">' + a + "</xf>" : "/>"}`);
  xfIndex[key] = xfs.length - 1;
  return xfIndex[key];
}
// fixed styles (index 0 must be the default)
xf("default");
const S = {
  page: xf("page", { fill: 2 }),
  farm: xf("farm", { font: "farm", fill: 2, align: 'vertical="bottom"' }),
  sub: xf("sub", { font: "sub", fill: 2, align: 'vertical="top"' }),
  contact: xf("contact", { font: "muted", fill: 2, align: 'horizontal="right" vertical="center"' }),
  rule: xf("rule", { fill: 2, border: 1 }),
  title: xf("title", { font: "title", fill: 2, align: 'vertical="center"' }),
  note: xf("note", { font: "muted", fill: 2 }),
  head: xf("head", { font: "head", fill: 3, border: 2, align: 'vertical="center" wrapText="1"' }),
  text: xf("text"),
  date: xf("date", { numFmt: NUMFMTS["yyyy-mm-dd h:mm:ss AM/PM"], align: 'horizontal="left"' }),
  num0: xf("num0", { numFmt: NUMFMTS["0"] }),
  num1: xf("num1", { numFmt: NUMFMTS["0.0"] }),
  crit: xf("crit", { font: "crit", align: 'horizontal="center"' }),
  high: xf("high", { font: "high", align: 'horizontal="center"' }),
  mod: xf("mod", { font: "mod", align: 'horizontal="center"' }),
  low: xf("low", { font: "low", align: 'horizontal="center"' }),
  min: xf("min", { font: "min", align: 'horizontal="center"' }),
};
const RISK_STYLE = { CRITICAL: S.crit, HIGH: S.high, MODERATE: S.mod, LOW: S.low, MINIMAL: S.min };

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd\\ h:mm:ss\\ AM/PM"/></numFmts>
<fonts count="${Object.keys(FONT).length}">${Object.values(FONT).join("")}</fonts>
<fills count="${FILLS.length}">${FILLS.join("")}</fills>
<borders count="${BORDERS.length}">${BORDERS.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

// ─── cells ─────────────────────────────────────────────────────────────
const cellText = (ref, text, style) =>
  `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
/** Rich text: runs of [text, bold] in the letterhead's label/value colours. */
const cellRich = (ref, runs, style) =>
  `<c r="${ref}" s="${style}" t="inlineStr"><is>${runs.map(([t, bold]) =>
    `<r><rPr>${bold ? "<b/>" : ""}<sz val="9"/><color rgb="${argb(bold ? COLORS.label : COLORS.muted)}"/><rFont val="Arial"/></rPr>`
    + `<t xml:space="preserve">${esc(t)}</t></r>`).join("")}</is></c>`;
const cellNum = (ref, n, style) => `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
const cellBlank = (ref, style) => `<c r="${ref}" s="${style}"/>`;

// ─── the report ────────────────────────────────────────────────────────
function buildReport({ sheetName = "Report", title, lines = [], columns, rows, logoPng, barPng, footer }) {
  const nCols = Math.max(columns.length, 6);
  const last = colName(nCols - 1);
  const HEAD_ROW = 12;                         // table header row
  const out = [];
  const rowXml = (r, cells, ht) => out.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells.join("")}</row>`);
  const pageRow = (r, filled = {}, ht) => {
    const cells = [];
    for (let c = 0; c < nCols; c++) cells.push(filled[c] || cellBlank(`${colName(c)}${r}`, S.page));
    rowXml(r, cells, ht);
  };

  // Letterhead: row 1 holds the green bar picture; rows 2-6 logo, farm name and contacts.
  const contacts = [
    [["Location: ", true], [FARM.addressLine1, false]],
    [[FARM.addressLine2, false]],
    [["Mobile: ", true], [FARM.mobile, false]],
    [["Email: ", true], [FARM.email, false]],
    [["Web: ", true], [FARM.web, false]],
  ];
  const lc = nCols - 1;
  pageRow(1, {}, 6);
  pageRow(2, { 1: cellText(`B2`, FARM.name, S.farm), [lc]: cellRich(`${last}2`, contacts[0], S.contact) }, 20);
  pageRow(3, { 1: cellText(`B3`, FARM.subtitle, S.sub), [lc]: cellRich(`${last}3`, contacts[1], S.contact) }, 15);
  pageRow(4, { [lc]: cellRich(`${last}4`, contacts[2], S.contact) }, 15);
  pageRow(5, { [lc]: cellRich(`${last}5`, contacts[3], S.contact) }, 15);
  pageRow(6, { [lc]: cellRich(`${last}6`, contacts[4], S.contact) }, 15);
  // rule under the letterhead
  { const cells = []; for (let c = 0; c < nCols; c++) cells.push(cellBlank(`${colName(c)}7`, S.rule)); rowXml(7, cells, 8); }
  pageRow(8, {}, 8);
  pageRow(9, { 0: cellText("A9", title, S.title) }, 22);
  pageRow(10, { 0: cellText("A10", lines[0] || "", S.note) });
  pageRow(11, { 0: cellText("A11", lines.slice(1).join("   ·   "), S.note) });

  // Table
  rowXml(HEAD_ROW, columns.map((c, i) => cellText(`${colName(i)}${HEAD_ROW}`, c.header, S.head)), 30);
  let r = HEAD_ROW;
  for (const row of rows) {
    r += 1;
    const cells = [];
    columns.forEach((c, i) => {
      const ref = `${colName(i)}${r}`;
      const v = row[i];
      if (v === null || v === undefined || v === "") return;
      if (c.type === "date") cells.push(cellNum(ref, phSerial(v).toFixed(8), S.date));
      else if (c.type === "number" && Number.isFinite(Number(v))) cells.push(cellNum(ref, Number(v), c.format === "0.0" ? S.num1 : S.num0));
      else if (c.type === "risk") {
        const up = String(v).toUpperCase();
        cells.push(cellText(ref, up.charAt(0) + up.slice(1).toLowerCase(), RISK_STYLE[up] ?? S.text));
      } else cells.push(cellText(ref, v, S.text));
    });
    rowXml(r, cells);
  }
  const lastRow = Math.max(r, HEAD_ROW);
  const tableRef = `A${HEAD_ROW}:${colName(columns.length - 1)}${lastRow}`;

  const cols = Array.from({ length: nCols }, (_, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${(columns[i] && columns[i].width) || 12}" customWidth="1"/>`).join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="${argb(COLORS.accent)}"/><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${last}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0" zoomScale="100"><pane ySplit="${HEAD_ROW}" topLeftCell="A${HEAD_ROW + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${HEAD_ROW + 1}" sqref="A${HEAD_ROW + 1}"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${out.join("")}</sheetData>
${rows.length ? `<autoFilter ref="${tableRef}"/>` : ""}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>${esc(`&C&"Arial,Italic"&8&K2D5A27${footer || FARM.tagline}&R&"Arial,Regular"&8Page &P of &N`)}</oddFooter></headerFooter>
<drawing r:id="rId1"/>
</worksheet>`;

  // Pictures: the green bar across row 1, the round logo over rows 2-6.
  const EMU = 9525; // per pixel
  const pic = (id, name, rel, from, to) => `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${from[0]}</xdr:col><xdr:colOff>${from[1]}</xdr:colOff><xdr:row>${from[2]}</xdr:row><xdr:rowOff>${from[3]}</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${to[0]}</xdr:col><xdr:colOff>${to[1]}</xdr:colOff><xdr:row>${to[2]}</xdr:row><xdr:rowOff>${to[3]}</xdr:rowOff></xdr:to>
<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${name}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
  const pictures = [];
  const media = [];
  if (barPng) { media.push(["image1.png", barPng]); pictures.push(pic(2, "Letterhead bar", "rIdImg1", [0, 0, 0, 0], [nCols, 0, 1, 0])); }
  if (logoPng) {
    media.push(["image2.png", logoPng]);
    // 84 px square from just inside A2 (rows 2-5 are 27 + 20 + 20 + 20 px); column A must be 13+ wide
    pictures.push(pic(3, "Farm logo", "rIdImg2", [0, 6 * EMU, 1, 3 * EMU], [0, 90 * EMU, 5, 0]));
  }
  const drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pictures.join("")}</xdr:wsDr>`;
  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${media.map(([f], i) =>
    `<Relationship Id="rIdImg${f === "image1.png" ? 1 : 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${f}"/>`).join("")}</Relationships>`;

  const safeSheet = esc(String(sheetName).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const created = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(title)}</dc:title><dc:creator>FarmSense Brew</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>` },
    { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FarmSense Brew</Application><Company>${esc(FARM.fullName)}</Company></Properties>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets>
<definedNames>${rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeSheet}'!$A$${HEAD_ROW}:$${colName(columns.length - 1)}$${lastRow}</definedName>` : ""}<definedName name="_xlnm.Print_Titles" localSheetId="0">'${safeSheet}'!$${HEAD_ROW}:$${HEAD_ROW}</definedName></definedNames>
</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: "xl/styles.xml", data: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
    { name: "xl/worksheets/_rels/sheet1.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>` },
    { name: "xl/drawings/drawing1.xml", data: drawing },
    { name: "xl/drawings/_rels/drawing1.xml.rels", data: drawingRels },
    ...media.map(([f, buf]) => ({ name: `xl/media/${f}`, data: buf })),
  ];
  return zip(files);
}

module.exports = { buildReport, phSerial };
