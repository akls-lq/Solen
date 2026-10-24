// Score de vigilance : récompense les bons réflexes face à une fraude et fait découvrir les fonctions de Solen.
// Reste dans le navigateur : c'est une démo, pas un suivi des salariés.

export type Reflex = "contre-appel" | "daf" | "signalement";

export const BADGES = [
  { id: "contre-appel", label: "Contre-appel au numéro enregistré", hint: "Appeler l'expéditeur au numéro connu, jamais à celui du mail." },
  { id: "daf", label: "Alerte transmise au DAF", hint: "Prévenir le DAF d'une tentative de fraude." },
  { id: "sosie", label: "Adresse sosie déjouée", hint: "Réagir à une adresse qui imite un fournisseur." },
  { id: "pression", label: "Pression hiérarchique déjouée", hint: "Ne pas céder à un faux dirigeant." },
  { id: "signalement", label: "Signalement au-delà de l'IA", hint: "Signaler un mail que Solen a jugé fiable." },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

const POINTS: Record<Reflex, number> = { "contre-appel": 30, daf: 20, signalement: 50 };
export const POINTS_PER_LEVEL = 100;

export type VigilanceState = {
  points: number;
  badges: BadgeId[];
  // Un même réflexe sur un même mail ne rapporte qu'une fois : « mailId:réflexe ».
  done: string[];
  // Fraudes déjouées : mailId → montant en jeu.
  protectedAmounts: Record<string, number>;
};

export const EMPTY_VIGILANCE: VigilanceState = { points: 0, badges: [], done: [], protectedAmounts: {} };

export type ReflexContext = {
  mailId: string;
  reflex: Reflex;
  alert: boolean;
  amount?: number;
  lookalike: boolean;
  impersonation: boolean;
};

export const applyReflex = (state: VigilanceState, ctx: ReflexContext): { state: VigilanceState; unlocked: BadgeId[] } => {
  const key = `${ctx.mailId}:${ctx.reflex}`;
  if (state.done.includes(key)) return { state, unlocked: [] };

  const earned: BadgeId[] = [ctx.reflex];
  const defended = ctx.alert && ctx.reflex !== "signalement";
  if (defended && ctx.lookalike) earned.push("sosie");
  if (defended && ctx.impersonation) earned.push("pression");
  const unlocked = earned.filter((b) => !state.badges.includes(b));

  return {
    unlocked,
    state: {
      points: state.points + POINTS[ctx.reflex],
      badges: [...state.badges, ...unlocked],
      done: [...state.done, key],
      protectedAmounts: defended ? { ...state.protectedAmounts, [ctx.mailId]: ctx.amount ?? 0 } : state.protectedAmounts,
    },
  };
};

export const level = (points: number) => Math.floor(points / POINTS_PER_LEVEL) + 1;
