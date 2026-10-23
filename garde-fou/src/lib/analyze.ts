import { FALLBACK_ANALYSES } from "@/data/fallback";
import { analyzeWithMistral, type AiAnalysis } from "./ai";
import { isPaymentRelated, runRules, VERDICT_RANK, worst, type RuleResult, type Verdict } from "./checks";
import { redactIbans } from "./iban";

export type MailPayload = {
  internetMessageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  headers: string;
  body: string;
  attachments: { name: string; text: string }[];
};

export type Reason = { text: string; source: "code" | "ia"; severity: Verdict };

export type AnalysisResult = {
  verdict: Verdict;
  infobar: string;
  sender: { verified: boolean; label: string };
  demande?: string;
  langue?: string;
  techniques: string[];
  reasons: Reason[];
  amount?: number;
  supplierName?: string;
  callback?: { who: string; phone: string; questions: string[] };
  ai: "mistral" | "secours" | "non-appelée";
};

// Un numéro de compte seul (RIB français) permet de reconstituer l'IBAN : il est masqué aussi.
const redactAccountNumbers = (text: string) => text.replace(/\b\d{9,}\b/g, "[NUMÉRO]");

export const buildAiInput = (mail: MailPayload, rules: RuleResult) => {
  const tokens = new Map<string, string>();
  const clean = (s: string) => redactAccountNumbers(redactIbans(s, tokens));
  const facts = [
    `Expéditeur : ${rules.verified ? "authentifié et connu de l'entreprise" : "non vérifié"} (${rules.sender.kind}).`,
    rules.supplier ? `Fournisseur concerné : ${rules.supplier.name}.` : "Aucun fournisseur connu concerné.",
    `IBAN dans le mail ou les pièces jointes : ${rules.iban.status}${rules.iban.status === "different" ? " (différent du profil fournisseur)" : ""}.`,
    rules.amount !== undefined
      ? `Montant : ${rules.amount} € (${rules.amountUsual === undefined ? "pas d'historique" : rules.amountUsual ? "habituel" : "inhabituel"}).`
      : "Aucun montant trouvé.",
  ];
  return [
    "CONTRÔLES TECHNIQUES",
    ...facts,
    "",
    `DE : ${mail.fromName} <${mail.fromEmail}>`,
    `OBJET : ${clean(mail.subject)}`,
    "",
    clean(mail.body),
    ...mail.attachments.map((a) => `\n--- PIÈCE JOINTE : ${a.name} ---\n${clean(a.text)}`),
  ].join("\n");
};

const getAi = async (mail: MailPayload, rules: RuleResult): Promise<{ analysis?: AiAnalysis; source: AnalysisResult["ai"] }> => {
  const fullText = [mail.subject, mail.body, ...mail.attachments.map((a) => a.text)].join("\n");
  if (!isPaymentRelated(fullText)) return { source: "non-appelée" };
  const fallback = FALLBACK_ANALYSES[mail.internetMessageId];
  if (process.env.GARDEFOU_AI === "secours" && fallback) return { analysis: fallback, source: "secours" };
  try {
    return { analysis: await analyzeWithMistral(buildAiInput(mail, rules)), source: "mistral" };
  } catch (error) {
    console.error("Mistral indisponible, analyse de secours :", error);
    return fallback ? { analysis: fallback, source: "secours" } : { source: "non-appelée" };
  }
};

const INFOBAR: Record<Verdict, string> = {
  fraude: "Garde-Fou : fraude probable. Ne payez pas avant un contre-appel au numéro enregistré.",
  suspect: "Garde-Fou : demande inhabituelle. Vérifiez auprès de l'expéditeur avant de payer.",
  fiable: "Garde-Fou : aucune anomalie détectée.",
};

export const buildResult = (rules: RuleResult, ai: { analysis?: AiAnalysis; source: AnalysisResult["ai"] }): AnalysisResult => {
  // Garde-fou : l'IA peut aggraver le verdict des règles, jamais l'adoucir.
  const verdict = ai.analysis ? worst(rules.verdict, ai.analysis.verdict) : rules.verdict;
  // En cas d'alerte, le volet ne garde que ce qui cloche : il doit se lire en quelques secondes.
  const reasons: Reason[] = [
    ...rules.findings.map((f) => ({ text: f.text, source: "code" as const, severity: f.severity })),
    ...(ai.analysis?.raisons ?? []).slice(0, 2).map((text) => ({ text, source: "ia" as const, severity: ai.analysis!.verdict })),
  ]
    .filter((r) => verdict === "fiable" || r.severity !== "fiable")
    .sort((a, b) => VERDICT_RANK[b.severity] - VERDICT_RANK[a.severity]);

  const differentIban = rules.iban.status === "different";
  const infobar =
    verdict === "fraude" && differentIban
      ? "Garde-Fou : IBAN différent du profil fournisseur. Ne payez pas avant un contre-appel au numéro enregistré."
      : INFOBAR[verdict];

  let callback: AnalysisResult["callback"];
  if (verdict !== "fiable") {
    const questions = ai.analysis?.questionsContreAppel ?? [];
    if (rules.supplier) callback = { who: rules.supplier.name, phone: rules.supplier.phone, questions };
    else if (rules.sender.kind === "impersonation") {
      // On rappelle la vraie personne via l'annuaire interne, jamais via le mail.
      const p = rules.sender.person;
      callback = { who: `${p.name} (${p.role})`, phone: p.phone, questions };
    }
  }

  const senderLabel =
    rules.sender.kind === "internal"
      ? "Collègue, domaine de l'entreprise"
      : rules.sender.kind === "supplier"
        ? `Fournisseur enregistré : ${rules.sender.supplier.name}`
        : rules.sender.kind === "impersonation"
          ? `Adresse externe, se présente comme ${rules.sender.person.name}`
          : rules.sender.kind === "lookalike"
            ? `Domaine sosie de ${rules.sender.imitates}`
            : "Expéditeur inconnu";

  return {
    verdict,
    infobar,
    sender: { verified: rules.verified, label: senderLabel },
    demande: ai.analysis?.demande,
    langue: ai.analysis?.langue,
    techniques: verdict === "fiable" ? [] : (ai.analysis?.techniques ?? []),
    reasons,
    amount: rules.amount,
    supplierName: rules.supplier?.name,
    callback,
    ai: ai.source,
  };
};

const cache = new Map<string, AnalysisResult>();

export const analyzeMail = async (mail: MailPayload) => {
  const key = `${mail.internetMessageId}|${mail.body.length}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const text = [mail.subject, mail.body, ...mail.attachments.map((a) => a.text)].join("\n");
  const rules = runRules({ fromName: mail.fromName, fromEmail: mail.fromEmail, headers: mail.headers, text });
  const result = buildResult(rules, await getAi(mail, rules));
  // On ne met en cache que les vraies analyses, pour retenter Mistral après une panne.
  if (result.ai !== "secours") cache.set(key, result);
  return result;
};
