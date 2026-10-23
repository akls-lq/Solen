// Contrôles déterministes : c'est ce code, et non l'IA, qui décide quand l'argent est en jeu.
import { COMPANY, DIRECTORY, SUPPLIERS, type Person, type Supplier } from "@/data/company";
import { findIbans, maskIban } from "./iban";

export type Verdict = "fiable" | "suspect" | "fraude";
export const VERDICT_RANK: Record<Verdict, number> = { fiable: 0, suspect: 1, fraude: 2 };
export const worst = (a: Verdict, b: Verdict) => (VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b);

export type AuthResult = { spf: string; dkim: string; dmarc: string };

export const parseAuthenticationResults = (headers: string): AuthResult => {
  const read = (key: string) => headers.match(new RegExp(`\\b${key}=(\\w+)`, "i"))?.[1].toLowerCase() ?? "none";
  return { spf: read("spf"), dkim: read("dkim"), dmarc: read("dmarc") };
};

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
  | { kind: "unknown" };

const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const classifySender = (displayName: string, email: string): SenderStatus => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === COMPANY.domain) {
    return { kind: "internal", person: DIRECTORY.find((p) => p.email === email.toLowerCase()) };
  }
  const supplier = SUPPLIERS.find((s) => s.domain === domain);
  if (supplier) return { kind: "supplier", supplier };

  // Un domaine à une ou deux lettres d'un domaine connu (transports-rnartin.fr) est un sosie.
  const known = [COMPANY.domain, ...SUPPLIERS.map((s) => s.domain)];
  const imitated = known.find((d) => levenshtein(d, domain) <= 2);
  if (imitated) return { kind: "lookalike", imitates: imitated };

  // Nom d'un dirigeant affiché, mais adresse externe : schéma de la fraude au président.
  const person = DIRECTORY.find((p) => p.aliases.includes(normalizeName(displayName)));
  if (person) return { kind: "impersonation", person };

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
}): RuleResult => {
  const auth = parseAuthenticationResults(mail.headers);
  const sender = classifySender(mail.fromName, mail.fromEmail);
  const verified = isVerifiedSender(auth, sender);
  const supplier = sender.kind === "supplier" ? sender.supplier : findMentionedSupplier(mail.text);
  const iban = checkIbans(findIbans(mail.text), supplier);
  const amount = findAmounts(mail.text).sort((a, b) => b - a)[0];
  const amountUsual =
    amount !== undefined && supplier ? amount >= supplier.usualAmount.min && amount <= supplier.usualAmount.max : undefined;

  const findings: Finding[] = [];
  if (!isAuthenticated(auth)) findings.push({ text: "L'expéditeur n'est pas authentifié (SPF, DKIM ou DMARC en échec).", severity: "suspect" });
  if (sender.kind === "lookalike") findings.push({ text: `Domaine sosie de ${sender.imitates}.`, severity: "fraude" });
  if (sender.kind === "impersonation")
    findings.push({
      text: `Se présente comme ${sender.person.name} (${sender.person.role}) depuis une adresse externe.`,
      severity: "suspect",
    });
  if (iban.status === "different" && supplier)
    findings.push({
      text: `IBAN ${iban.masked} différent de celui du profil (${iban.expectedMasked}), utilisé pour ${supplier.paymentsToIban} paiements depuis ${supplier.since}.`,
      severity: "fraude",
    });
  if (iban.status === "inconnu") findings.push({ text: "IBAN fourni par un expéditeur inconnu.", severity: "suspect" });
  if (amount !== undefined && amountUsual === false && supplier)
    findings.push({ text: `Montant inhabituel pour ${supplier.name} (${formatEuros(amount)}).`, severity: "suspect" });

  // Constats rassurants, affichés quand rien ne cloche.
  if (verified && sender.kind === "internal" && sender.person)
    findings.push({ text: `Mail interne authentifié de ${sender.person.name} (${sender.person.role}).`, severity: "fiable" });
  if (verified && sender.kind === "supplier")
    findings.push({ text: `Expéditeur authentifié : domaine de ${sender.supplier.name}.`, severity: "fiable" });
  if (supplier && iban.status === "absent" && amount !== undefined)
    findings.push({ text: `Fournisseur connu, aucun changement de coordonnées bancaires demandé.`, severity: "fiable" });
  if (iban.status === "identique") findings.push({ text: "IBAN identique à celui du profil fournisseur.", severity: "fiable" });
  if (amount !== undefined && amountUsual)
    findings.push({ text: `Montant habituel pour ${supplier!.name} (${formatEuros(amount)}).`, severity: "fiable" });

  const verdict = findings.reduce<Verdict>((v, f) => worst(v, f.severity), "fiable");
  return { verdict, findings, auth, sender, verified, supplier, iban, amount, amountUsual };
};

// L'IA n'est appelée que pour les mails qui parlent d'argent : moins de coût, moins de données envoyées.
const PAYMENT_WORDS =
  /virement|payer|paiement|régler|règlement|facture|iban|\brib\b|coordonnées bancaires|überweis|rechnung|bankverbindung|zahlung|invoice|payment|wire transfer|bank details/i;

export const isPaymentRelated = (text: string) => PAYMENT_WORDS.test(text);
