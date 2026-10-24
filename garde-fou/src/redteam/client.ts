import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult } from "@/lib/analyze";

export type TestMail = {
  internetMessageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  headers: string;
  body: string;
  // Chemin d'un PDF sous public/, ou contenu base64 déjà prêt.
  attachments: { name: string; file?: string; base64?: string }[];
};

const BASE = process.env.SOLEN_URL ?? "http://localhost:3100";

export const callApi = async (mail: TestMail): Promise<AnalysisResult> => {
  const attachments = await Promise.all(
    mail.attachments.map(async (a) => ({
      name: a.name,
      contentType: "application/pdf",
      contentBase64: a.base64 ?? (await readFile(path.join(process.cwd(), "public", a.file!))).toString("base64"),
    })),
  );
  const response = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...mail, attachments }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
