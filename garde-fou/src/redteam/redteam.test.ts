// Chaque attaque doit être arrêtée par le code seul, même si l'IA est trompée et répond « fiable ».
import { describe, expect, it } from "vitest";
import { MAILS } from "@/data/mails";
import { buildResult } from "@/lib/analyze";
import { runRules, VERDICT_RANK, type Verdict } from "@/lib/checks";
import { pdfText } from "@/lib/pdf";
import { CASES } from "./cases";
import type { TestMail } from "./client";

const FOOLED_AI = {
  source: "mistral" as const,
  analysis: { demande: "", langue: "", techniques: [], verdict: "fiable" as Verdict, raisons: [], questionsContreAppel: [] },
};

const verdictWithFooledAi = async (m: TestMail) => {
  const read = await Promise.all(
    m.attachments.map(async (a) => ({ name: a.name, text: await pdfText(new Uint8Array(Buffer.from(a.base64 ?? "", "base64"))) })),
  );
  const rules = runRules({
    fromName: m.fromName,
    fromEmail: m.fromEmail,
    headers: m.headers,
    text: [m.subject, m.body, ...read.map((r) => r.text ?? "")].join("\n"),
    unreadableAttachments: read.filter((r) => !r.text?.trim()).map((r) => r.name),
  });
  return buildResult(rules, FOOLED_AI);
};

describe("Attaques arrêtées par le code, IA trompée", () => {
  for (const c of CASES.filter((c) => c.expected !== "fiable")) {
    it(`${c.family} : ${c.attack}`, async () => {
      const result = await verdictWithFooledAi(await c.mail());
      expect(VERDICT_RANK[result.verdict]).toBeGreaterThanOrEqual(VERDICT_RANK[c.expected]);
      if (c.rule) expect(result.reasons.map((r) => r.text).join("\n")).toContain(c.rule);
    });
  }
});

describe("Pas de fausse alerte sur les vrais mails", () => {
  for (const c of CASES.filter((c) => c.expected === "fiable")) {
    it(c.attack, async () => {
      expect((await verdictWithFooledAi(await c.mail())).verdict).toBe("fiable");
    });
  }
  for (const id of ["daf", "dubois", "news"]) {
    it(`mail de démo « ${id} »`, async () => {
      const m = MAILS.find((x) => x.id === id)!;
      const { verdict } = await verdictWithFooledAi({
        internetMessageId: m.internetMessageId,
        subject: m.subject,
        fromName: m.from.displayName,
        fromEmail: m.from.emailAddress,
        headers: m.internetHeaders,
        body: m.body,
        attachments: [],
      });
      expect(verdict).toBe("fiable");
    });
  }
});
