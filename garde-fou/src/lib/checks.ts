// Contrôles déterministes : c'est ce code, et non l'IA, qui décide quand l'argent est en jeu.
import { domainToUnicode } from "node:url";
import { COMPANY, DIRECTORY, SUPPLIERS, type Person, type Supplier } from "@/data/company";
import { findIbans, findRibIbans, maskIban } from "./iban";

export type Verdict = "fiable" | "suspect" | "fraude";
export const VERDICT_RANK: Record<Verdict, number> = { fiable: 0, suspect: 1, fraude: 2 };
export const worst = (a: Verdict, b: Verdict) => (VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b);

export type AuthResult = { spf: string; dkim: string; dmarc: string };

// Un attaquant peut glisser son propre en-tête « spf=pass » dans le mail : s'il y a plusieurs résultats,
// on garde le plus défavorable au lieu du premier trouvé.
export const parseAuthenticationResults = (headers: string): AuthResult => {
  const read = (key: string) => {
    const values = [...headers.matchAll(new RegExp(`\\b${key}=(\\w+)`, "gi"))].map((m) => m[1].toLowerCase());
    if (values.length === 0) return "none";
    return values.find((v) => v !== "pass") ?? "pass";
  };
  return { spf: read("spf"), dkim: read("dkim"), dmarc: read("dmarc") };
};

export const parseReplyTo = (headers: string) =>
  headers.match(/^Reply-To:.*?([\w.+-]+@[\w.-]+)/im)?.[1].toLowerCase();

const levenshtein = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
};

export type SenderStatus =
  | { kind: "internal"; person?: Person }
  | { kind: "supplier"; supplier: Supplier }
  | { kind: "lookalike"; imitates: string }
  | { kind: "impersonation"; person: Person }
  | { kind: "supplier-impersonation"; supplier: Supplier }
  | { kind: "unknown" };

const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Lettres cyrilliques et grecques qui ressemblent à des lettres latines (trаnsports avec un « а » cyrillique).
const CONFUSABLES: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i", ј: "j", ѕ: "s", һ: "h", ԁ: "d", ӏ: "l",
  α: "a", ο: "o", ρ: "p", ν: "v", τ: "t", ι: "i", κ: "k",
};

// Forme comparable d'un domaine : punycode décodé (xn--…), sosies de lettres ramenés au latin.
const foldDomain = (domain: string) =>
  [...domainToUnicode(domain.toLowerCase()) || domain.toLowerCase()].map((c) => CONFUSABLES[c] ?? c).join("");

// Squelette d’un domaine : lettres et chiffres sans extension (nuvio-cloud.fr → nuviocloud).
const skeleton = (domain: string) => foldDomain(domain).replace(/\.[a-z]+$/, "").replace(/[^a-z0-9]/g, "");

const imitatedDomain = (domain: string) => {
  const folded = foldDomain(domain);
  const known = [COMPANY.domain, ...SUPPLIERS.map((s) => s.domain)];
  return known.find(
    (d) =>
      levenshtein(d, folded) <= 2 ||
      skeleton(d) === skeleton(domain) ||
      // nuviocloud-fr.com contient le squelette de nuvio-cloud.fr.
      // Couvre aussi les sous-domaines pièges : nuvio-cloud.fr.paiement-securise.com.
      (skeleton(d).length >= 8 && skeleton(domain).includes(skeleton(d))),
  );
};

export type Segment = { text: string; odd: boolean };

// Découpe le faux domaine en morceaux et marque les lettres qui diffèrent du vrai (lum[l]o-data.fr),
// pour que l'utilisateur voie la supercherie d'un coup d'œil.
export const highlightLookalike = (fakeDomain: string, realDomain: string): Segment[] => {
  const shown = [...(domainToUnicode(fakeDomain.toLowerCase()) || fakeDomain.toLowerCase())];
  const a = shown.map((c) => CONFUSABLES[c] ?? c);
  const b = [...realDomain];
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  // Remonte l'alignement : une lettre est suspecte si elle est remplacée, ajoutée, ou si c'est un sosie étranger.
  const odd = shown.map((c, i) => c !== a[i]);
  for (let i = a.length, j = b.length; i > 0; ) {
    if (j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) odd[i - 1] = true;
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      odd[--i] = true;
    } else j--;
  }
  const segments: Segment[] = [];
  shown.forEach((c, i) => {
    const last = segments[segments.length - 1];
    if (last && last.odd === odd[i]) last.text += c;
    else segments.push({ text: c, odd: odd[i] });
  });
  return segments;
};

export const classifySender = (displayName: string, email: string): SenderStatus => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === COMPANY.domain) {
    return { kind: "internal", person: DIRECTORY.find((p) => p.email === email.toLowerCase()) };
  }
  const supplier = SUPPLIERS.find((s) => s.domain === domain);
  if (supplier) return { kind: "supplier", supplier };

  const imitated = imitatedDomain(domain);
  if (imitated) return { kind: "lookalike", imitates: imitated };

  // Nom d'un dirigeant affiché, mais adresse externe : schéma de la fraude au président.
  const name = normalizeName(displayName);
  const person = DIRECTORY.find((p) => p.aliases.includes(name));
  if (person) return { kind: "impersonation", person };

  // Nom d'un fournisseur affiché depuis une autre adresse (Gmail, domaine inconnu).
  const named = SUPPLIERS.find((s) => name.includes(normalizeName(s.name).replace(" gmbh", "")));
  if (named) return { kind: "supplier-impersonation", supplier: named };

  return { kind: "unknown" };
};

export const isAuthenticated = (auth: AuthResult) =>
  auth.dmarc === "pass" && (auth.spf === "pass" || auth.dkim === "pass");

// « Vérifié » = authentifié ET connu de l'entreprise. Un Gmail authentifié reste « non vérifié ».
export const isVerifiedSender = (auth: AuthResult, sender: SenderStatus) =>
  isAuthenticated(auth) && (sender.kind === "internal" || sender.kind === "supplier");

// Montants écrits « 18 400,00 € », « 2 350 € », « 9.870,00 EUR ».
export const findAmounts = (text: string) => {
  const amounts: number[] = [];
  const pattern = /(\d{1,3}(?:[  .]\d{3})*|\d+)(?:,(\d{2}))?\s?(?:€|EUR\b|euros?\b)/gi;
  for (const m of text.matchAll(pattern)) {
    const value = Number(m[1].replace(/[  .]/g, "")) + (m[2] ? Number(m[2]) / 100 : 0);
    if (value > 0) amounts.push(value);
  }
  return amounts;
};

export const findMentionedSupplier = (text: string) => {
  const lower = text.toLowerCase();
  return SUPPLIERS.find((s) => lower.includes(s.name.toLowerCase().replace(" gmbh", "")));
};

// Annonces de changement de banque, en français, anglais et allemand.
const BANK_CHANGE =
  /chang\w*\s+(?:de|d'|d’)\s*(?:banque|établissement bancaire|coordonnées bancaires|rib|iban)|nouveau\s+(?:compte|rib|iban)|nouvelles?\s+coordonnées\s+bancaires|new\s+(?:bank|account|iban)|updated\s+(?:bank|payment)\s+details|neue\s+bankverbindung|bankverbindung\s+geändert/i;

// Phrases adressées à l'outil d'analyse plutôt qu'à un humain : tentative de manipulation de l'IA.
const TOOL_INJECTION =
  /ignore\w*\s+(?:toutes?\s+)?(?:tes|vos|les)\s+(?:consignes|instructions)|ignore (?:all |your )?(?:previous )?instructions|(?:mark|classify|flag)\s+(?:this|the)\s+(?:e-?mail|message|invoice)\s+as\s+(?:safe|legitimate)|note\s+to\s+the\s+(?:ai|assistant)|(?:outil|assistant|logiciel)\s+(?:d'analyse|anti-?fraude)|verdict\s+(?:attendu|:)?\s*fiable|ne\s+pas\s+afficher\s+d'alerte/i;

export type IbanCheck =
  | { status: "absent" }
  | { status: "identique"; masked: string }
  | { status: "different"; masked: string; expectedMasked: string }
  | { status: "inconnu"; masked: string };

export const checkIbans = (ibans: string[], supplier?: Supplier): IbanCheck => {
  if (ibans.length === 0) return { status: "absent" };
  if (!supplier) return { status: "inconnu", masked: maskIban(ibans[0]) };
  const other = ibans.find((i) => i !== supplier.iban);
  if (other) return { status: "different", masked: maskIban(other), expectedMasked: maskIban(supplier.iban) };
  return { status: "identique", masked: maskIban(supplier.iban) };
};

export type Finding = { text: string; severity: Verdict };

export type RuleResult = {
  fromEmail: string;
  verdict: Verdict;
  findings: Finding[];
  auth: AuthResult;
  sender: SenderStatus;
  verified: boolean;
  supplier?: Supplier;
  iban: IbanCheck;
  amount?: number;
  amountUsual?: boolean;
};

const formatEuros = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}\u00a0€`;

export const runRules = (mail: {
  fromName: string;
  fromEmail: string;
  headers: string;
  text: string;
  unreadableAttachments?: string[];
}): RuleResult => {
  const auth = parseAuthenticationResults(mail.headers);
  const sender = classifySender(mail.fromName, mail.fromEmail);
  const verified = isVerifiedSender(auth, sender);
  const supplier =
    sender.kind === "supplier" || sender.kind === "supplier-impersonation"
      ? sender.supplier
      : sender.kind === "lookalike"
        ? (SUPPLIERS.find((s) => s.domain === sender.imitates) ?? findMentionedSupplier(mail.text))
        : findMentionedSupplier(mail.text);
  const iban = checkIbans([...new Set([...findIbans(mail.text), ...findRibIbans(mail.text)])], supplier);
  const amount = findAmounts(mail.text).sort((a, b) => b - a)[0];
  const amountUsual =
    amount !== undefined && supplier ? amount >= supplier.usualAmount.min && amount <= supplier.usualAmount.max : undefined;

  const findings: Finding[] = [];
  if (!isAuthenticated(auth)) findings.push({ text: "Expéditeur non authentifié.", severity: "suspect" });
  if (sender.kind === "lookalike") findings.push({ text: `Adresse qui imite ${sender.imitates}.`, severity: "fraude" });
  if (sender.kind === "impersonation")
    findings.push({
      text: `Se fait passer pour ${sender.person.name} (${sender.person.role}) depuis une adresse externe.`,
      severity: "suspect",
    });
  if (iban.status === "different" && supplier)
    findings.push({
      text: `Nouvel IBAN : l'habituel a servi ${supplier.paymentsToIban} fois depuis ${supplier.since}.`,
      severity: "fraude",
    });
  if (sender.kind === "supplier-impersonation")
    findings.push({ text: `Se fait passer pour ${sender.supplier.name} depuis une autre adresse.`, severity: "suspect" });
  if (iban.status === "inconnu") findings.push({ text: "IBAN envoyé par un inconnu.", severity: "suspect" });
  if (iban.status !== "different" && BANK_CHANGE.test(mail.text))
    findings.push({ text: "Annonce un changement de banque.", severity: "suspect" });
  if (mail.unreadableAttachments?.length)
    findings.push({ text: `Pièce jointe illisible : IBAN impossible à vérifier.`, severity: "suspect" });
  const replyTo = parseReplyTo(mail.headers);
  const fromDomain = mail.fromEmail.split("@")[1]?.toLowerCase();
  if (replyTo && replyTo.split("@")[1] !== fromDomain)
    findings.push({ text: `Les réponses partiraient vers ${replyTo}.`, severity: "suspect" });
  if (TOOL_INJECTION.test(mail.text))
    findings.push({ text: "Consignes cachées pour tromper l'analyse.", severity: "suspect" });
  const external = sender.kind === "unknown" || sender.kind === "impersonation";
  // Lien envoyé par quelqu'un que l'entreprise ne connaît pas : faux portail de paiement ou de connexion.
  const link = mail.text.match(/https?:\/\/([^\s/]+)/i)?.[1];
  if (link && sender.kind !== "internal" && sender.kind !== "supplier")
    findings.push({ text: `Lien vers un site inconnu : ${link}.`, severity: "suspect" });
  if (external && amount !== undefined && isPaymentRelated(mail.text))
    findings.push({ text: "Demande de paiement d'un inconnu.", severity: "suspect" });
  if (amount !== undefined && amountUsual === false && supplier)
    findings.push({ text: `Montant inhabituel : ${formatEuros(amount)}.`, severity: "suspect" });

  // Constats rassurants, affichés quand rien ne cloche.
  if (verified && sender.kind === "internal" && sender.person)
    findings.push({ text: `Mail authentifié de ${sender.person.name} (${sender.person.role}).`, severity: "fiable" });
  if (verified && sender.kind === "supplier")
    findings.push({ text: `Domaine authentique de ${sender.supplier.name}.`, severity: "fiable" });
  if (supplier && iban.status === "absent" && amount !== undefined)
    findings.push({ text: `Fournisseur connu, coordonnées inchangées.`, severity: "fiable" });
  if (iban.status === "identique") findings.push({ text: "IBAN habituel.", severity: "fiable" });
  if (amount !== undefined && amountUsual)
    findings.push({ text: `Montant habituel : ${formatEuros(amount)}.`, severity: "fiable" });

  const verdict = findings.reduce<Verdict>((v, f) => worst(v, f.severity), "fiable");
  return { fromEmail: mail.fromEmail, verdict, findings, auth, sender, verified, supplier, iban, amount, amountUsual };
};

// L'IA n'est appelée que pour les mails qui parlent d'argent : moins de coût, moins de données envoyées.
const PAYMENT_WORDS =
  /virement|payer|paiement|régler|règlement|facture|iban|\brib\b|coordonnées bancaires|überweis|rechnung|bankverbindung|zahlung|invoice|payment|wire transfer|bank details/i;

export const isPaymentRelated = (text: string) => PAYMENT_WORDS.test(text);
