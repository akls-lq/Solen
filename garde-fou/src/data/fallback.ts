// Analyses de secours, écrites à l'avance : utilisées si Mistral ou le réseau tombe pendant la démo,
// ou si SOLEN_AI=secours pour développer sans consommer de crédits.
import type { AiAnalysis } from "@/lib/ai";

export const FALLBACK_ANALYSES: Record<string, AiAnalysis> = {
  "<20261023104212.7f3a@nuvio-cloud.fr>": {
    demande: "Payer la facture n°2026-114 de 18 400 € sur un nouveau compte bancaire.",
    langue: "français",
    techniques: ["prétexte d'actualité", "changement de coordonnées bancaires", "urgence"],
    verdict: "fraude",
    raisons: [
      "La réforme ne force personne à changer de banque : prétexte.",
      "Seul ce mail demande de payer ailleurs.",
      "Délai court pour empêcher de vérifier.",
    ],
    questionsContreAppel: [
      "Avez-vous envoyé ce matin un mail annonçant un changement de banque ?",
      "Pouvez-vous me confirmer les 4 derniers chiffres de votre IBAN ?",
      "Qui, chez vous, a signé ce nouveau RIB ?",
    ],
  },
  "<20261023101503.11ab@arkos-systems.fr>": {
    demande: "Régler aujourd'hui la facture F-2026-219 de Lumio Data (2 350 €).",
    langue: "français",
    techniques: ["urgence"],
    verdict: "fiable",
    raisons: [
      "Urgence expliquée : facture échue, fournisseur qui relance.",
      "Circuit habituel, rien d'anormal.",
    ],
    questionsContreAppel: [],
  },
  "<20261023100512.4b2e@de1ivery-partners.fr>": {
    demande: "Payer la facture DP-2026-118 de 14 400 € sur un nouveau compte, sous 48 h.",
    langue: "français",
    techniques: ["changement de coordonnées bancaires", "urgence"],
    verdict: "fraude",
    raisons: [
      "Changement de banque glissé dans la facture : faux RIB classique.",
      "Délai de 48 h pour empêcher de vérifier.",
    ],
    questionsContreAppel: [
      "Nous avez-vous envoyé la facture DP-2026-118 ?",
      "Avez-vous changé de banque ce mois-ci ?",
      "Utilisez-vous l'adresse de1ivery-partners.fr ?",
    ],
  },
  "<20261023095801.c2d4@mueller-technik.de>": {
    demande: "Payer la facture 2026-0388 de 9 870 € sur une nouvelle banque avant vendredi.",
    langue: "allemand",
    techniques: ["changement de coordonnées bancaires", "urgence"],
    verdict: "fraude",
    raisons: [
      "Nouvelle banque annoncée sans explication.",
      "Le nouveau compte n'est que dans le PDF.",
      "Délai court : « bis Freitag ».",
    ],
    questionsContreAppel: [
      "Avez-vous changé de banque récemment ?",
      "Pouvez-vous me confirmer les 4 derniers chiffres de votre IBAN ?",
      "Qui a envoyé la facture 2026-0388 ?",
    ],
  },
  "<CAF8x2kQ7@mail.gmail.com>": {
    demande: "Faire aujourd'hui un virement confidentiel de 35 000 € pour une acquisition.",
    langue: "français",
    techniques: ["autorité", "secret", "contournement de la hiérarchie"],
    verdict: "fraude",
    raisons: [
      "Un PDG n'écrit pas depuis Gmail pour 35 000 €.",
      "Il exige le secret, même vis-à-vis du DAF.",
      "Il empêche toute vérification par téléphone.",
    ],
    questionsContreAppel: [
      "Jean-Pierre Durand a-t-il demandé un virement de 35 000 € ce matin ?",
      "Utilise-t-il une adresse Gmail pour l'entreprise ?",
      "Marc Lefèvre est-il informé de cette opération ?",
    ],
  },
  "<20261022174512.a1c9@banquehorizon-alerte.com>": {
    demande: "Faire un « virement de sécurité » de 12 450 € vers un compte de protection.",
    langue: "français",
    techniques: ["urgence", "autorité", "contournement de la hiérarchie"],
    verdict: "fraude",
    raisons: [
      "Une banque ne demande jamais de virement pour protéger un compte.",
      "Il interdit d'appeler l'agence.",
    ],
    questionsContreAppel: [
      "Une opération suspecte a-t-elle été détectée sur notre compte ?",
      "La banque a-t-elle demandé un virement vers un compte de protection ?",
      "Ce mail vient-il bien de vos services ?",
    ],
  },
  "<20261022161044.9e01@lumio-data.fr>": {
    demande: "Régler la facture F-2026-219 de 2 350 € sur le compte habituel.",
    langue: "français",
    techniques: [],
    verdict: "fiable",
    raisons: ["Relance normale d'un fournisseur connu."],
    questionsContreAppel: [],
  },
};
