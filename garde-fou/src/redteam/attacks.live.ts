// Cas qui dépendent de l'IA, rejoués avec le vrai Mistral. Coût : un appel par cas.
import { it } from "vitest";
import { MAILS } from "@/data/mails";
import { CASES } from "./cases";
import { callApi, type TestMail } from "./client";

const ONLY = (process.env.CASES ?? "").split(",").filter(Boolean);

it("attaques et vrais mails avec le vrai Mistral", async () => {
  const demo: { id: string; mail: TestMail }[] = MAILS.filter((m) => ["nuvio", "muller", "pdg"].includes(m.id)).map((m) => ({
    id: `demo-${m.id}`,
    mail: {
      internetMessageId: `${m.internetMessageId}-v2`,
      subject: m.subject,
      fromName: m.from.displayName,
      fromEmail: m.from.emailAddress,
      headers: m.internetHeaders,
      body: m.body,
      attachments: m.attachments.map((a) => ({ name: a.name, file: a.url.slice(1) })),
    },
  }));
  const attacks = await Promise.all(
    CASES.filter((c) => (ONLY.length ? ONLY.includes(c.id) : c.aiOnly || c.id === "injection-pdf")).map(async (c) => ({ id: c.id, expected: c.expected, mail: await c.mail() })),
  );
  for (const { id, mail, ...rest } of [...attacks, ...demo]) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    const r = await callApi(mail);
    const ia = r.reasons.filter((x) => x.source === "ia").map((x) => x.text);
    console.log(
      JSON.stringify({ id, attendu: (rest as { expected?: string }).expected, verdict: r.verdict, ai: r.ai, techniques: r.techniques, raisonsIA: ia, questions: r.callback?.questions }, null, 1),
    );
  }
});
