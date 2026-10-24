// PDF piégés générés à la volée pour les tests d'attaque.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

// hiddenLines : écrites en blanc sur blanc, invisibles à l'écran mais lues par l'analyse.
export const textPdf = async (lines: string[], hiddenLines: string[] = []) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 18, size: 11, font }));
  hiddenLines.forEach((l, i) => page.drawText(l, { x: 50, y: 300 - i * 12, size: 6, font, color: rgb(1, 1, 1) }));
  return toBase64(await doc.save());
};

// Simule un RIB scanné : aucune couche texte, seulement des formes.
export const imageOnlyPdf = async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  for (let i = 0; i < 30; i++) page.drawRectangle({ x: 50 + (i % 10) * 45, y: 600 - Math.floor(i / 10) * 30, width: 30, height: 12 });
  return toBase64(await doc.save());
};

export const corruptedPdf = () => Buffer.from("%PDF-1.7\n%âã\n1 0 obj << /Type /Catalog >>\ngarbage").toString("base64");
