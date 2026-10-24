import { describe, expect, it } from "vitest";
import { findIbans, maskIban, redactIbans } from "../iban";
import { findAmounts, runRules, worst } from "../checks";

const pass = (domain: string) =>
  `Authentication-Results: mx; spf=pass smtp.mailfrom=${domain}; dkim=pass header.d=${domain}; dmarc=pass header.from=${domain}`;

describe("IBAN", () => {
  it("trouve un IBAN écrit par groupes de 4, même suivi d'un autre mot", () => {
    expect(findIbans("IBAN : FR78 1695 8000 0100 4712 8148 213 BIC : HRZNFRP1")).toEqual(["FR7816958000010047128148213"]);
  });

  it("ignore une suite qui ressemble à un IBAN mais dont la clé est fausse", () => {
    expect(findIbans("Référence FR76 1234 5678 9012 3456 7890 123")).toEqual([]);
  });

  it("ne laisse aucun chiffre de l'IBAN dans le texte envoyé à l'IA", () => {
    const tokens = new Map<string, string>();
    const out = redactIbans("Nouveau compte : FR78 1695 8000 0100 4712 8148 213. Merci.", tokens);
    expect(out).toBe("Nouveau compte : [IBAN_1]. Merci.");
    expect(out).not.toMatch(/1695|8148/);
  });

  it("masque l'IBAN à l'affichage", () => {
    expect(maskIban("FR0310278060410002098765530")).toBe("FR03 •••• •••• 5530");
  });
});

describe("Montants", () => {
  it("lit les formats français et allemand", () => {
    expect(findAmounts("facture de 18 400,00 € et 2 350 €")).toEqual([18400, 2350]);
    expect(findAmounts("Gesamtbetrag: 9.870,00 EUR")).toEqual([9870]);
  });
});

describe("Règles", () => {
  it("fournisseur authentique, mais IBAN différent du profil : fraude, quoi que dise l'IA", () => {
    const r = runRules({
      fromName: "Nuvio Cloud",
      fromEmail: "facturation@nuvio-cloud.fr",
      headers: pass("nuvio-cloud.fr"),
      text: "Merci de régler la facture de 18 400,00 € sur notre nouveau compte FR78 1695 8000 0100 4712 8148 213",
    });
    expect(r.verified).toBe(true);
    expect(r.iban.status).toBe("different");
    expect(r.verdict).toBe("fraude");
    // L'IA ne peut qu'aggraver le verdict des règles, jamais l'adoucir.
    expect(worst(r.verdict, "fiable")).toBe("fraude");
  });

  it("mail urgent du vrai DAF pour un fournisseur connu au montant habituel : aucune alerte", () => {
    const r = runRules({
      fromName: "Marc Lefèvre",
      fromEmail: "m.lefevre@arkos-systems.fr",
      headers: pass("arkos-systems.fr"),
      text: "Urgent : peux-tu régler aujourd'hui la facture F-2026-219 de Lumio Data (2 350,00 €) ?",
    });
    expect(r.verdict).toBe("fiable");
    expect(r.amountUsual).toBe(true);
  });

  it("nom du PDG affiché depuis un Gmail : non vérifié et signalé", () => {
    const r = runRules({
      fromName: "Jean-Pierre Durand",
      fromEmail: "jp.durand.pdg@gmail.com",
      headers: pass("gmail.com"),
      text: "J'ai besoin d'un virement de 35 000 € aujourd'hui.",
    });
    expect(r.verified).toBe(false);
    expect(r.sender.kind).toBe("impersonation");
    expect(r.verdict).not.toBe("fiable");
  });

  it("domaine sosie d'un fournisseur : fraude", () => {
    const r = runRules({
      fromName: "Nuvio Cloud",
      fromEmail: "facturation@nuvi0-cloud.fr",
      headers: pass("nuvi0-cloud.fr"),
      text: "Merci de régler la facture.",
    });
    expect(r.sender.kind).toBe("lookalike");
    expect(r.verdict).toBe("fraude");
  });

  it("SPF et DMARC en échec : jamais vérifié", () => {
    const r = runRules({
      fromName: "Lumio Data",
      fromEmail: "comptabilite@lumio-data.fr",
      headers: "Authentication-Results: mx; spf=fail; dkim=none; dmarc=fail",
      text: "Relance facture.",
    });
    expect(r.verified).toBe(false);
    expect(r.verdict).toBe("suspect");
  });
});
