import { describe, expect, it } from "vitest";
import { applyReflex, EMPTY_VIGILANCE, level } from "./vigilance";

const nuvio = { mailId: "nuvio", alert: true, amount: 18400, lookalike: false, impersonation: false };

describe("Score de vigilance", () => {
  it("récompense le contre-appel sur une fraude et compte le montant protégé", () => {
    const { state, unlocked } = applyReflex(EMPTY_VIGILANCE, { ...nuvio, reflex: "contre-appel" });
    expect(state.points).toBe(30);
    expect(unlocked).toEqual(["contre-appel"]);
    expect(state.protectedAmounts).toEqual({ nuvio: 18400 });
  });

  it("ne rapporte rien si on clique deux fois sur le même réflexe", () => {
    const once = applyReflex(EMPTY_VIGILANCE, { ...nuvio, reflex: "contre-appel" }).state;
    const twice = applyReflex(once, { ...nuvio, reflex: "contre-appel" });
    expect(twice.state.points).toBe(30);
    expect(twice.unlocked).toEqual([]);
  });

  it("débloque les badges sosie et faux dirigeant quand on réagit à ces fraudes", () => {
    const sosie = applyReflex(EMPTY_VIGILANCE, { mailId: "sosie", reflex: "daf", alert: true, amount: 2480, lookalike: true, impersonation: false });
    expect(sosie.unlocked).toEqual(["daf", "sosie"]);
    const pdg = applyReflex(sosie.state, { mailId: "pdg", reflex: "daf", alert: true, amount: 35000, lookalike: false, impersonation: true });
    expect(pdg.unlocked).toEqual(["pression"]);
  });

  it("signaler un mail jugé fiable rapporte un bonus, sans compter une fraude déjouée", () => {
    const { state, unlocked } = applyReflex(EMPTY_VIGILANCE, { mailId: "news", reflex: "signalement", alert: false, lookalike: false, impersonation: false });
    expect(state.points).toBe(50);
    expect(unlocked).toEqual(["signalement"]);
    expect(state.protectedAmounts).toEqual({});
  });

  it("passe au niveau suivant tous les 100 points", () => {
    expect(level(0)).toBe(1);
    expect(level(130)).toBe(2);
  });
});
