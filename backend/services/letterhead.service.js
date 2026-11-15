/**
 * FarmSense Brew — Javier Permaculture Farm letterhead for exported reports
 * File: backend/services/letterhead.service.js
 *
 * Follows the farm's official letterhead (Javier_Permaculture_Farm_Letterhead.pdf):
 * green gradient bar, round logo, "JAVIER PERMACULTURE / FARM & CAMP SITE",
 * contact block on the right, off-white page, footer band with the tagline.
 */
const path = require("path");

const FARM = {
  name: "JAVIER PERMACULTURE",
  subtitle: "FARM & CAMP SITE",
  fullName: "Javier Permaculture Farm & Camp Site",
  addressLine1: "Sitio Karot, Lapo Lapu 2nd",
  addressLine2: "San Jose, Batangas 4227, Philippines",
  mobile: "+63 916 555 9549",
  email: "javierpermaculturefarm@gmail.com",
  web: "javierpermaculturefarm.wordpress.com",
  tagline: "Nurturing Earth • Building Community • Inspiring Sustainable Living",
};

const COLORS = {
  page: "#FAF9F5",
  footerBand: "#F4F6F1",
  rule: "#D4E0C8",
  title: "#1E3B1B",
  accent: "#2D5A27",
  subtitle: "#557A46",
  label: "#2D5A27",
  muted: "#4A5D4E",
  footerText: "#5A6E5D",
  body: "#333333",
};

const ASSETS = path.join(__dirname, "..", "assets");
const LOGO = path.join(ASSETS, "jpcf-letterhead-logo.png");
const BAR = path.join(ASSETS, "jpcf-letterhead-bar.png");

// A4 in points, and the content area between the header and the footer band.
const PAGE = { width: 595.28, height: 841.89 };
const CONTENT = { left: 37, right: 37, top: 146, bottom: 76 };

/** Philippine date and time, e.g. "September 18, 2026" / "Sep 18, 2026, 1:15 AM". */
function phDate(d = new Date()) {
  return d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
}
function phShort(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function phDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function drawPage(doc) {
  const { width, height } = PAGE;
  const saved = { ...doc.page.margins };
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 }; // draw in the margins without new pages
  doc.save();
  doc.rect(0, 0, width, height).fill(COLORS.page);
  try { doc.image(BAR, 0, 0, { width, height: 6 }); } catch { doc.rect(0, 0, width, 6).fill(COLORS.accent); }
  try { doc.image(LOGO, 34, 25, { width: 91, height: 90 }); } catch { /* logo is optional */ }

  doc.fillColor(COLORS.title).font("Helvetica-Bold").fontSize(20)
     .text(FARM.name, 126, 45, { lineBreak: false, characterSpacing: 0.6 });
  doc.fillColor(COLORS.subtitle).font("Helvetica").fontSize(10.5)
     .text(FARM.subtitle, 127, 74, { lineBreak: false, characterSpacing: 2.6 });

  // contact block, right-aligned
  const right = width - 33;
  const rows = [
    ["Location: ", FARM.addressLine1],
    ["", FARM.addressLine2],
    ["Mobile: ", FARM.mobile],
    ["Email: ", FARM.email],
    ["Web: ", FARM.web],
  ];
  let y = 33;
  doc.fontSize(8.5);
  for (const [label, value] of rows) {
    doc.font("Helvetica");
    const vw = doc.widthOfString(value);
    doc.font("Helvetica-Bold");
    const lw = label ? doc.widthOfString(label) : 0;
    const x = right - vw - lw;
    if (label) doc.fillColor(COLORS.label).text(label, x, y, { lineBreak: false });
    doc.font("Helvetica").fillColor(COLORS.muted).text(value, x + lw, y, { lineBreak: false });
    y += 13.5;
  }
  doc.moveTo(0, 120.5).lineTo(width, 120.5).lineWidth(1).strokeColor(COLORS.rule).stroke();

  // footer band
  doc.rect(0, height - 59, width, 59).fill(COLORS.footerBand);
  doc.moveTo(0, height - 59).lineTo(width, height - 59).lineWidth(1).strokeColor(COLORS.rule).stroke();
  doc.fillColor(COLORS.accent).font("Helvetica-Oblique").fontSize(8)
     .text(FARM.tagline, 0, height - 47, { width, align: "center", lineBreak: false });
  doc.fillColor(COLORS.footerText).font("Helvetica").fontSize(8)
     .text(`${FARM.addressLine1}, ${FARM.addressLine2} | ${FARM.mobile}`, 0, height - 31, { width, align: "center", lineBreak: false });
  doc.restore();
  doc.page.margins = saved;
  doc.x = CONTENT.left;
  doc.y = CONTENT.top;
  doc.fillColor(COLORS.body).font("Helvetica").fontSize(10.5);
}

/**
 * A pdfkit document on the farm letterhead. Every page (including pages
 * added automatically when text runs over) gets the header and footer.
 */
function createLetterheadPdf(PDFDocument, options = {}) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: CONTENT.top, bottom: CONTENT.bottom, left: CONTENT.left, right: CONTENT.right },
    bufferPages: true,
    ...options,
  });
  drawPage(doc);
  doc.on("pageAdded", () => drawPage(doc));
  return doc;
}

/** Page numbers ("Page 1 of 2") in the footer band, once all pages exist. */
function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const saved = { ...doc.page.margins };
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    doc.fillColor(COLORS.footerText).font("Helvetica").fontSize(7.5)
       .text(`Page ${i + 1} of ${range.count}`, 0, PAGE.height - 18, { width: PAGE.width - 37, align: "right", lineBreak: false });
    doc.page.margins = saved;
  }
}

/**
 * Letterhead lines for the top of a CSV report (spreadsheets show them as
 * a header block above the table).
 */
function csvPreamble(title, user, extra = []) {
  const q = (s) => (/[",]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  return [
    q(FARM.fullName),
    q(FARM.tagline),
    q(`${FARM.addressLine1}, ${FARM.addressLine2}`),
    q(`Mobile: ${FARM.mobile} | Email: ${FARM.email} | Web: ${FARM.web}`),
    "",
    q(`FarmSense Brew: ${title}`),
    q(`Generated ${phDateTime(new Date())} (Philippine time) by ${user.username} (${String(user.role || "").replace("_", " ")})`),
    ...extra.map(q),
    "",
  ];
}

module.exports = { FARM, COLORS, PAGE, CONTENT, phDate, phDateTime, phShort, createLetterheadPdf, addPageNumbers, csvPreamble };
