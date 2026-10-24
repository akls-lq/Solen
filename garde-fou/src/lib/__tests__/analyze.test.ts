import { afterEach, describe, expect, it, vi } from "vitest";
import { MAILS } from "@/data/mails";
import { buildAiInput, buildResult, analyzeMail, type MailPayload } from "../analyze";
import { runRules } from "../checks";
import * as ai from "../ai";

const RIB_TEXT = `RELEVÉ D'IDENTITÉ BANCAIRE
Titulaire du compte NUVIO CLOUD
Code banque 16958 Code guichet 00001 N° de compte 00471281482 Clé RIB 13
IBAN FR78 1695 8000 0100 4712 8148 213
BIC HRZNFRP1XXX`;

const martin = MAILS.find((m) => m.id === "nuvio")!;
const martinPayload: MailPayload = {
  internetMessageId: martin.internetMessageId,
  subject: martin.subject,
  fromName: martin.from.displayName,
  fromEmail: martin.from.emailAddress,
  headers: martin.internetHeaders,
  body: martin.body,
  attachments: [{ name: "Nouveau_RIB_Nuvio_Cloud.pdf", text: RIB_TEXT }],
};

const rulesFor = (p: MailPayload) =>
  runRules({
    fromName: p.fromName,
    fromEmail: p.fromEmail,
    headers: p.headers,
    text: [p.subject, p.body, ...p.attachments.map((a) => a.text)].join("\n"),
  });

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SOLEN_AI;
});

describe("Texte envoyé à Mistral", () => {
  it("ne contient ni l'IBAN ni le numéro de compte du RIB joint", () => {
    const input = buildAiInput(martinPayload, rulesFor(martinPayload));
    expect(input).toContain("[IBAN_1]");
    expect(input).not.toMatch(/FR78|8148 213|00471281482/);
  });
});

describe("Verdict final", () => {
  it("reste « fraude » sur un IBAN différent même si l'IA répond « fiable »", () => {
    const result = buildResult(rulesFor(martinPayload), {
      source: "mistral",
      analysis: { demande: "", langue: "français", techniques: [], verdict: "fiable", raisons: [], questionsContreAppel: [] },
    });
    expect(result.verdict).toBe("fraude");
    expect(result.callback).toMatchObject({ who: "Nuvio Cloud", phone: "04 72 18 52 30" });
    expect(result.infobar.length).toBeLessThanOrEqual(150);
  });

  it("propose le contre-appel au numéro du profil, jamais à un numéro écrit dans le mail", () => {
    const payload = { ...martinPayload, body: `${martin.body}\n\nPour toute question : 06 12 34 56 78` };
    const result = buildResult(rulesFor(payload), { source: "non-appelée" });
    expect(result.callback?.phone).toBe("04 72 18 52 30");
  });

  it("propose toujours des questions de contre-appel, même si l'IA n'en donne pas", async () => {
    const pdg = { fromName: "Direction Générale", fromEmail: "direction.generale.durand@gmail.com", headers: "", text: "Virement de 48 000 € aujourd'hui, confidentiel." };
    const result = buildResult(runRules(pdg), {
      source: "mistral",
      analysis: { demande: "", langue: "français", techniques: ["secret"], verdict: "fraude", raisons: [], questionsContreAppel: [] },
    });
    // Expéditeur inconnu : on fait valider par le DAF, au numéro de l'annuaire.
    expect(result.callback).toMatchObject({ who: "Marc Lefèvre (DAF)", phone: "01 84 25 10 12" });
    expect(result.callback?.questions).toHaveLength(3);
  });

  it("utilise l'analyse de secours si Mistral tombe pendant la démo", async () => {
    vi.spyOn(ai, "analyzeWithMistral").mockRejectedValue(new Error("réseau"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await analyzeMail({ ...martinPayload, body: `${martin.body} ` });
    expect(result.ai).toBe("secours");
    expect(result.verdict).toBe("fraude");
  });

  it("alerte au lieu de laisser passer quand l'IA tombe sur un mail inconnu qui demande de l'argent", async () => {
    vi.spyOn(ai, "analyzeWithMistral").mockRejectedValue(new Error("réseau"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const daf = MAILS.find((m) => m.id === "daf")!;
    const result = await analyzeMail({
      internetMessageId: "<inconnu-sans-secours@arkos-systems.fr>",
      subject: daf.subject,
      fromName: daf.from.displayName,
      fromEmail: daf.from.emailAddress,
      headers: daf.internetHeaders,
      body: daf.body,
      attachments: [],
    });
    expect(result.ai).toBe("échec");
    expect(result.verdict).toBe("suspect");
  });

  it("n'appelle pas l'IA pour un mail sans rapport avec l'argent", async () => {
    const spy = vi.spyOn(ai, "analyzeWithMistral");
    const news = MAILS.find((m) => m.id === "news")!;
    const result = await analyzeMail({
      internetMessageId: news.internetMessageId,
      subject: news.subject,
      fromName: news.from.displayName,
      fromEmail: news.from.emailAddress,
      headers: news.internetHeaders,
      body: news.body,
      attachments: [],
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.verdict).toBe("fiable");
  });
});
