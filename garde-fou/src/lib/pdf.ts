import { extractText, getDocumentProxy } from "unpdf";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Renvoie null si le PDF est illisible : l'appelant doit le traiter comme un risque, pas comme un PDF vide.
export const pdfText = async (bytes: Uint8Array): Promise<string | null> => {
  if (bytes.length > MAX_ATTACHMENT_BYTES) return null;
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    return null;
  }
};
