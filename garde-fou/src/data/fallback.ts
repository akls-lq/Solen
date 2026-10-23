// Analyses de secours, écrites à l'avance : utilisées si Mistral ou le réseau tombe pendant la démo,
// ou si GARDEFOU_AI=secours pour développer sans consommer de crédits.
import type { AiAnalysis } from "@/lib/ai";

export const FALLBACK_ANALYSES: Record<string, AiAnalysis> = {
  "<20261023104212.7f3a@transports-martin.fr>": {
    demande: "Payer la facture n°2026-114 de 18 400 € sur un nouveau compte bancaire.",
    langue: "français",
    techniques: ["prétexte d'actualité", "changement de coordonnées bancaires", "urgence"],
    verdict: "fraude",
    raisons: [
      "La réforme de la facturation électronique n'oblige personne à changer de banque : c'est un prétexte.",
      "La facture est arrivée normalement sur la plateforme, seul ce mail demande de payer ailleurs.",
      "La date limite de lundi pousse à payer avant de vérifier.",
    ],
    questionsContreAppel: [
      "Avez-vous envoyé ce matin un mail annonçant un changement de banque ?",
      "Pouvez-vous me confirmer les 4 derniers chiffres de votre IBAN ?",
      "Qui, chez vous, a signé ce nouveau RIB ?",
    ],
  },
  "<20261023101503.11ab@durand-industries.fr>": {
    demande: "Régler aujourd'hui la facture F-2026-219 d'Imprimerie Dubois (2 350 €).",
    langue: "français",
    techniques: ["urgence"],
    verdict: "fiable",
    raisons: [
      "L'urgence est expliquée : la facture est échue et le fournisseur a relancé.",
      "La demande suit le circuit habituel, sans changement de coordonnées bancaires.",
    ],
    questionsContreAppel: [],
  },
  "<20261023095801.c2d4@mueller-technik.de>": {
    demande: "Payer la facture 2026-0388 de 9 870 € sur une nouvelle banque avant vendredi.",
    langue: "allemand",
    techniques: ["changement de coordonnées bancaires", "urgence"],
    verdict: "fraude",
    raisons: [
      "Le mail annonce une nouvelle banque sans explication.",
      "Le nouveau compte n'apparaît que sur la facture jointe, pas dans le mail.",
      "Le délai court (« bis Freitag ») laisse peu de temps pour vérifier.",
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
      "Le PDG n'écrit pas depuis une adresse Gmail pour un virement de 35 000 €.",
      "Il demande le secret, y compris vis-à-vis du DAF : c'est le schéma de la fraude au président.",
      "Il dit ne pas pouvoir parler, ce qui empêche toute vérification par téléphone.",
    ],
    questionsContreAppel: [
      "Jean-Pierre Durand a-t-il demandé un virement de 35 000 € ce matin ?",
      "Utilise-t-il une adresse Gmail pour l'entreprise ?",
      "Marc Lefèvre est-il informé de cette opération ?",
    ],
  },
  "<20261022161044.9e01@imprimerie-dubois.fr>": {
    demande: "Régler la facture F-2026-219 de 2 350 € sur le compte habituel.",
    langue: "français",
    techniques: [],
    verdict: "fiable",
    raisons: ["Simple relance d'un fournisseur connu, sans changement de coordonnées bancaires."],
    questionsContreAppel: [],
  },
};
