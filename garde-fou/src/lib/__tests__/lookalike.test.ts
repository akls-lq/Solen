import { describe, expect, it } from "vitest";
import { highlightLookalike, runRules } from "../checks";
import { buildResult } from "../analyze";

const odd = (fake: string, real: string) =>
  highlightLookalike(fake, real)
    .filter((s) => s.odd)
    .map((s) => s.text);

describe("Surlignage des adresses qui imitent un fournisseur", () => {
  it("montre le « l » qui remplace le « i » de lumio", () => {
    expect(odd("lumlo-data.fr", "lumio-data.fr")).toEqual(["l"]);
  });

  it("montre le « rn » qui imite un « m »", () => {
    expect(odd("transports-rnartin.fr", "transports-martin.fr")).toEqual(["rn"]);
  });

  it("montre une lettre cyrillique invisible à l'œil nu", () => {
    expect(odd("trаnsports-martin.fr", "transports-martin.fr")).toEqual(["а"]);
  });

  it("donne au volet l'adresse découpée et le domaine imité, et compare l'IBAN au vrai fournisseur", () => {
    const rules = runRules({
      fromName: "Lumio Data",
      fromEmail: "comptabilite@lumlo-data.fr",
      headers: "Authentication-Results: mx; spf=pass; dkim=pass; dmarc=pass",
      text: "Facture F-2026-247 de 2 480,00 € à régler sur FR78 1695 8000 0100 4712 8148 213",
    });
    const result = buildResult(rules, { source: "non-appelée" });
    expect(result.verdict).toBe("fraude");
    expect(result.sender.lookalike).toMatchObject({ local: "comptabilite", imitates: "lumio-data.fr" });
    expect(result.infobar).toContain("imite lumio-data.fr");
    expect(result.callback?.phone).toBe("01 84 60 12 45");
  });
});
