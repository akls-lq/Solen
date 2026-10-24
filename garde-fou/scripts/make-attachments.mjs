// Génère les pièces jointes fictives de la démo : des PDF avec du texte, lisibles sans OCR.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";

const grey = rgb(0.4, 0.4, 0.4);
const line = rgb(0.8, 0.8, 0.8);

const make = async (file, draw) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const t = (text, x, y, size = 10, f = font, color = rgb(0, 0, 0)) => page.drawText(text, { x, y, size, font: f, color });
  const hr = (y) => page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: line });
  draw({ t, hr, page, font, bold });
  await writeFile(new URL(`../public/attachments/${file}`, import.meta.url), await doc.save());
};

await make("Nouveau_RIB_Nuvio_Cloud.pdf", ({ t, hr, page, bold }) => {
  t("BANQUE HORIZON", 50, 780, 16, bold, rgb(0.05, 0.2, 0.45));
  t("Agence Paris Opéra · 8 boulevard Haussmann · 75009 Paris", 50, 762, 9, undefined, grey);
  t("RELEVÉ D'IDENTITÉ BANCAIRE", 50, 715, 13, bold);
  hr(705);
  t("Titulaire du compte", 50, 680, 9, undefined, grey);
  t("NUVIO CLOUD", 50, 664, 11, bold);
  t("12 rue des Entrepreneurs, 69007 Lyon", 50, 650, 10);
  const cols = [["Code banque", "16958"], ["Code guichet", "00001"], ["N° de compte", "00471281482"], ["Clé RIB", "13"]];
  cols.forEach(([h, v], i) => {
    t(h, 50 + i * 125, 610, 9, undefined, grey);
    t(v, 50 + i * 125, 594, 11);
  });
  hr(580);
  t("IBAN (International Bank Account Number)", 50, 555, 9, undefined, grey);
  t("FR78 1695 8000 0100 4712 8148 213", 50, 538, 13, bold);
  t("BIC (Bank Identifier Code)", 50, 510, 9, undefined, grey);
  t("HRZNFRP1XXX", 50, 494, 12);
  hr(475);
  t("Document à remettre à vos débiteurs pour le règlement de vos factures.", 50, 455, 8, undefined, grey);
  page.drawRectangle({ x: 400, y: 640, width: 145, height: 60, borderColor: line, borderWidth: 0.7 });
  t("Date d'édition", 410, 683, 8, undefined, grey);
  t("21/10/2026", 410, 668, 10);
});

await make("Rechnung_2026-0388.pdf", ({ t, hr, bold }) => {
  t("MÜLLER TECHNIK GmbH", 50, 780, 16, bold, rgb(0.1, 0.1, 0.1));
  t("Industriestraße 41 · 50829 Köln · Deutschland · USt-IdNr. DE298765431", 50, 762, 9, undefined, grey);
  t("Arkos Systems", 50, 720, 10);
  t("Service comptabilité · Frau Claire Bernard", 50, 706, 10);
  t("18 rue de la Pépinière · 75008 Paris · Frankreich", 50, 692, 10);
  t("RECHNUNG", 50, 650, 14, bold);
  t("Rechnungsnummer: 2026-0388", 360, 720, 10);
  t("Rechnungsdatum: 21.10.2026", 360, 706, 10);
  t("Kundennummer: 10457", 360, 692, 10);
  hr(630);
  t("Pos.", 50, 615, 9, bold); t("Beschreibung", 90, 615, 9, bold); t("Menge", 350, 615, 9, bold); t("Betrag", 470, 615, 9, bold);
  hr(605);
  t("1", 50, 588, 10); t("Server-Rack R-450", 90, 588, 10); t("6", 350, 588, 10); t("7.920,00 EUR", 470, 588, 10);
  t("2", 50, 570, 10); t("Netzwerk-Switch NS-12", 90, 570, 10); t("30", 350, 570, 10); t("1.230,00 EUR", 470, 570, 10);
  t("3", 50, 552, 10); t("Versand (Spedition)", 90, 552, 10); t("1", 350, 552, 10); t("720,00 EUR", 470, 552, 10);
  hr(535);
  t("Gesamtbetrag:", 350, 515, 11, bold); t("9.870,00 EUR", 470, 515, 11, bold);
  t("Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).", 50, 485, 8, undefined, grey);
  t("Zahlbar bis 30.10.2026 ohne Abzug.", 50, 455, 10);
  t("Neue Bankverbindung:", 50, 430, 10, bold);
  t("Berliner Neobank AG · IBAN DE45 1001 1001 2614 9602 15 · BIC BNEODEB1XXX", 50, 414, 10);
});
console.log("ok");
