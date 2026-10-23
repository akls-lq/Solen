import { extractText, getDocumentProxy } from "unpdf";
import { analyzeMail, type MailPayload } from "@/lib/analyze";

type Body = Omit<MailPayload, "attachments"> & {
  // Comme getAttachmentContentAsync d'Office.js : le contenu arrive encodé en base64.
  attachments: { name: string; contentType: string; contentBase64: string }[];
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const attachmentText = async (a: Body["attachments"][number]) => {
  if (a.contentType !== "application/pdf") return "";
  const bytes = Buffer.from(a.contentBase64, "base64");
  if (bytes.length > MAX_ATTACHMENT_BYTES) return "";
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
};

export const POST = async (request: Request) => {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof body?.body !== "string" || typeof body?.fromEmail !== "string") {
    return Response.json({ error: "Mail incomplet" }, { status: 400 });
  }
  const attachments = await Promise.all(
    (body.attachments ?? []).map(async (a) => ({ name: a.name, text: await attachmentText(a).catch(() => "") })),
  );
  return Response.json(await analyzeMail({ ...body, attachments }));
};
