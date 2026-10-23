// Côté navigateur : ce que ferait le module Outlook avec Office.js, lire le mail puis appeler notre API.
import type { Mail } from "@/data/mails";
import type { AnalysisResult } from "@/lib/analyze";

const toBase64 = async (url: string) => {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const cache = new Map<string, Promise<AnalysisResult>>();

const request = async (mail: Mail): Promise<AnalysisResult> => {
  const attachments = await Promise.all(
    mail.attachments.map(async (a) => ({ name: a.name, contentType: a.contentType, contentBase64: await toBase64(a.url) })),
  );
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      internetMessageId: mail.internetMessageId,
      subject: mail.subject,
      fromName: mail.from.displayName,
      fromEmail: mail.from.emailAddress,
      headers: mail.internetHeaders,
      body: mail.body,
      attachments,
    }),
  });
  if (!response.ok) throw new Error(`Analyse impossible (HTTP ${response.status})`);
  return response.json();
};

// Une seule analyse par mail et par session : recliquer ne consomme pas de crédits Mistral.
export const analyze = (mail: Mail) => {
  if (!cache.has(mail.id)) {
    const pending = request(mail);
    pending.catch(() => cache.delete(mail.id));
    cache.set(mail.id, pending);
  }
  return cache.get(mail.id)!;
};
