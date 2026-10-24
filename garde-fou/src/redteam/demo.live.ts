import { it } from "vitest";
import { MAILS } from "@/data/mails";
import { callApi } from "./client";

it("les mails de démo avec le vrai Mistral", async () => {
  for (const m of MAILS) {
    const r = await callApi({
      internetMessageId: m.internetMessageId,
      subject: m.subject,
      fromName: m.from.displayName,
      fromEmail: m.from.emailAddress,
      headers: m.internetHeaders,
      body: m.body,
      attachments: m.attachments.map((a) => ({ name: a.name, file: a.url.slice(1) })),
    });
    console.log(JSON.stringify({ mail: m.id, verdict: r.verdict, ai: r.ai, demande: r.demande, langue: r.langue, techniques: r.techniques, raisons: r.reasons.filter((x) => x.source === "ia").map((x) => x.text), questions: r.callback?.questions }, null, 1));
  }
});
