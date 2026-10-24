import { expect, it } from "vitest";
import { FALLBACK_ANALYSES } from "@/data/fallback";
import { MAILS } from "@/data/mails";
import { buildResult } from "../analyze";
import { runRules } from "../checks";

// Outlook refuse ou tronque une notification de module au-delà de 150 caractères.
it("chaque bandeau de la démo tient dans la limite Outlook de 150 caractères", () => {
  for (const m of MAILS) {
    const rules = runRules({ fromName: m.from.displayName, fromEmail: m.from.emailAddress, headers: m.internetHeaders, text: `${m.subject}\n${m.body}` });
    const analysis = FALLBACK_ANALYSES[m.internetMessageId];
    const { infobar } = buildResult(rules, analysis ? { analysis, source: "secours" } : { source: "non-appelée" });
    expect(infobar.length, m.id).toBeLessThanOrEqual(150);
  }
});
