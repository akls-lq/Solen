import { FALLBACK_ANALYSES } from "@/data/fallback";
import { COMPANY, DIRECTORY, IT_SUPPORT } from "@/data/company";
import { analyzeWithMistral, type AiAnalysis } from "./ai";
import { highlightLookalike, isPaymentRelated, runRules, VERDICT_RANK, worst, type RuleResult, type Segment, type Verdict } from "./checks";
import { redactIbans } from "./iban";

export type MailPayload = {
  internetMessageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  headers: string;
  body: string;
  // unreadable : PDF corrompu ou scanné sans texte. On ne peut pas y vérifier l'IBAN.
  attachments: { name: string; text: string; unreadable?: boolean }[];
};

export type Reason = { text: string; source: "code" | "ia"; severity: Verdict };

export type AnalysisResult = {
  verdict: Verdict;
  infobar: string;
  sender: { verified: boolean; label: string; kind: string; lookalike?: { local: string; segments: Segment[]; imitates: string } };
  demande?: string;
  langue?: string;
  techniques: string[];
  reasons: Reason[];
  amount?: number;
  supplierName?: string;
  callback?: { who: string; phone: string; questions: string[] };
  ai: "mistral" | "secours" | "non-appelée" | "échec";
};

// Au-delà, le texte est tronqué : un mail géant ne doit pas faire exploser le coût ni noyer les consignes.
const MAX_AI_INPUT_CHARS = 8000;

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
  ]
    .join("\n")
    .slice(0, MAX_AI_INPUT_CHARS);
};

const getAi = async (mail: MailPayload, rules: RuleResult): Promise<{ analysis?: AiAnalysis; source: AnalysisResult["ai"] }> => {
  const fullText = [mail.subject, mail.body, ...mail.attachments.map((a) => a.text)].join("\n");
  if (!isPaymentRelated(fullText)) return { source: "non-appelée" };
  const fallback = FALLBACK_ANALYSES[mail.internetMessageId];
  if (process.env.SOLEN_AI === "secours" && fallback) return { analysis: fallback, source: "secours" };
  try {
    return { analysis: await analyzeWithMistral(buildAiInput(mail, rules)), source: "mistral" };
  } catch (error) {
    console.error("Mistral indisponible, analyse de secours :", error);
    return fallback ? { analysis: fallback, source: "secours" } : { source: "échec" };
  }
};

const INFOBAR: Record<Verdict, string> = {
  fraude: "Solen : fraude probable. Ne payez pas avant un contre-appel au numéro enregistré.",
  suspect: "Solen : demande inhabituelle. Vérifiez auprès de l'expéditeur avant de payer.",
  fiable: "Solen : aucune anomalie détectée.",
};

export const buildResult = (rules: RuleResult, ai: { analysis?: AiAnalysis; source: AnalysisResult["ai"] }): AnalysisResult => {
  // Solen : l'IA peut aggraver le verdict des règles, jamais l'adoucir.
  // Si l'IA devait analyser une demande d'argent et a échoué, on alerte au lieu de laisser passer.
  const aiFailed = ai.source === "échec";
  const verdict = worst(ai.analysis ? worst(rules.verdict, ai.analysis.verdict) : rules.verdict, aiFailed ? "suspect" : "fiable");
  // En cas d'alerte, le volet ne garde que ce qui cloche : il doit se lire en quelques secondes.
  const reasons: Reason[] = [
    ...rules.findings.map((f) => ({ text: f.text, source: "code" as const, severity: f.severity })),
    ...(ai.analysis?.raisons ?? [])
      // Les contrôles techniques sont déjà affichés : on écarte les raisons de l'IA qui les répètent.
      .filter((text) => !/authentifi|\bIBAN\b|montant (?:et|est|habituel)|connu de l'entreprise/i.test(text))
      .slice(0, 2)
      .map((text) => ({ text, source: "ia" as const, severity: ai.analysis!.verdict })),
    ...(aiFailed
      ? [{ text: "Analyse par l'IA indisponible : vérifiez cette demande de paiement avant de payer.", source: "code" as const, severity: "suspect" as const }]
      : []),
  ]
    .filter((r) => verdict === "fiable" || r.severity !== "fiable")
    .sort((a, b) => VERDICT_RANK[b.severity] - VERDICT_RANK[a.severity])
    // Le panneau doit se lire en quelques secondes : trois raisons au plus.
    .slice(0, 3);

  const differentIban = rules.iban.status === "different";
  // Le bandeau d'Outlook est limité à 150 caractères : verdict, montant en jeu, puis la consigne.
  const stake = verdict !== "fiable" && rules.amount ? ` ${rules.amount.toLocaleString("fr-FR")}\u00a0€ en jeu.` : "";
  const lookalike = rules.sender.kind === "lookalike" ? rules.sender.imitates : undefined;
  const phishingLink = rules.findings.find((f) => f.text.startsWith("Lien vers un site inconnu"));
  const infobar =
    phishingLink && rules.amount === undefined
      ? `Solen : ${lookalike ? `adresse qui imite ${lookalike}` : "lien vers un site inconnu de l'entreprise"}. Ne saisissez pas vos identifiants.`
      : lookalike
        ? `Solen : adresse qui imite ${lookalike}.${stake} Ne payez pas avant un contre-appel au numéro enregistré.`
        : verdict === "fraude" && differentIban
      ? `Solen : IBAN différent du profil fournisseur.${stake} Ne payez pas avant un contre-appel au numéro enregistré.`
      : INFOBAR[verdict].replace(/^(Solen : [^.]+\.)/, `$1${stake}`);

  let callback: AnalysisResult["callback"];
  if (verdict !== "fiable") {
    // L'IA ne propose pas toujours de questions : on garde des questions par défaut, sûres dans tous les cas.
    const aiQuestions = ai.analysis?.questionsContreAppel ?? [];
    if (rules.supplier) {
      const questions = aiQuestions.length
        ? aiQuestions
        : ["Avez-vous envoyé ce mail ?", "Avez-vous changé de coordonnées bancaires ?", "Pouvez-vous me confirmer les 4 derniers chiffres de votre IBAN ?"];
      callback = { who: rules.supplier.name, phone: rules.supplier.phone, questions };
    } else {
      // On rappelle la vraie personne via l'annuaire interne, jamais via le mail ; à défaut, le DAF valide la demande.
      const imitatesCompany = rules.sender.kind === "lookalike" && rules.sender.imitates === COMPANY.domain;
      const p =
        rules.sender.kind === "impersonation"
          ? rules.sender.person
          : imitatesCompany
            ? IT_SUPPORT
            : DIRECTORY.find((d) => d.role === "DAF")!;
      const questions = aiQuestions.length
        ? aiQuestions
        : imitatesCompany
          ? ["Avez-vous envoyé un mail sur la double authentification ?", "L'adresse " + rules.fromEmail + " est-elle à vous ?", "Que dois-je faire si j'ai cliqué sur le lien ?"]
          : [`Avez-vous demandé ce virement${rules.amount ? ` de ${rules.amount.toLocaleString("fr-FR")}\u00a0€` : ""} ?`, "Ce mail vient-il bien de vous ?", "Qui d'autre doit valider cette opération ?"];
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
          : rules.sender.kind === "supplier-impersonation"
            ? `Adresse externe, se présente comme ${rules.sender.supplier.name}`
            : rules.sender.kind === "lookalike"
            ? "Adresse inconnue de l'entreprise"
            : "Expéditeur inconnu";

  return {
    verdict,
    infobar,
    sender: {
      verified: rules.verified,
      label: senderLabel,
      kind: rules.sender.kind,
      ...(lookalike && {
        lookalike: {
          local: rules.fromEmail.split("@")[0],
          segments: highlightLookalike(rules.fromEmail.split("@")[1] ?? "", lookalike),
          imitates: lookalike,
        },
      }),
    },
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
  const rules = runRules({
    fromName: mail.fromName,
    fromEmail: mail.fromEmail,
    headers: mail.headers,
    text,
    unreadableAttachments: mail.attachments.filter((a) => a.unreadable).map((a) => a.name),
  });
  const result = buildResult(rules, await getAi(mail, rules));
  // On ne met en cache que les vraies analyses, pour retenter Mistral après une panne.
  if (result.ai === "mistral" || result.ai === "non-appelée") cache.set(key, result);
  return result;
};
