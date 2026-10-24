import { analyzeMail, type MailPayload } from "@/lib/analyze";
import { pdfText } from "@/lib/pdf";

type Body = Omit<MailPayload, "attachments"> & {
  // Comme getAttachmentContentAsync d'Office.js : le contenu arrive encodé en base64.
  attachments: { name: string; contentType: string; contentBase64: string }[];
};

const MAX_BODY_CHARS = 50_000;
const MAX_ATTACHMENTS = 5;

// Limite par adresse IP : sans elle, n'importe qui pourrait vider les crédits Mistral
// ou tester ses faux mails en boucle jusqu'à trouver celui qui passe.
const RATE_LIMIT = { max: 20, windowMs: 60_000 };
const hits = new Map<string, number[]>();

const rateLimited = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.max;
};

const readAttachment = async (a: Body["attachments"][number]) => {
  if (a.contentType !== "application/pdf") return { name: a.name, text: "" };
  const text = await pdfText(new Uint8Array(Buffer.from(a.contentBase64 ?? "", "base64")));
  // Un PDF sans texte est un scan : on ne peut pas y lire l'IBAN, donc on le signale.
  return text === null || text.trim() === "" ? { name: a.name, text: "", unreadable: true } : { name: a.name, text };
};

export const POST = async (request: Request) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "Trop de demandes, réessayez dans une minute." }, { status: 429 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof body?.body !== "string" || typeof body?.fromEmail !== "string") {
    return Response.json({ error: "Mail incomplet" }, { status: 400 });
  }
  if (body.body.length > MAX_BODY_CHARS || (body.attachments ?? []).length > MAX_ATTACHMENTS) {
    return Response.json({ error: "Mail trop volumineux" }, { status: 413 });
  }
  const attachments = await Promise.all((body.attachments ?? []).map(readAttachment));
  return Response.json(await analyzeMail({ ...body, attachments }));
};
