// Même forme que ce qu'un module Outlook lit via Office.js (item.subject, item.from, item.body,
// item.attachments, getAllInternetHeadersAsync) : brancher le vrai Outlook ne change que la source.

export type MailAttachment = { id: string; name: string; contentType: string; size: number; url: string };

export type Mail = {
  id: string;
  internetMessageId: string;
  subject: string;
  from: { displayName: string; emailAddress: string };
  to: string;
  // Heure de réception ; dayOffset = 0 aujourd'hui, -1 hier.
  received: { dayOffset: number; time: string };
  body: string;
  attachments: MailAttachment[];
  internetHeaders: string;
  unread?: boolean;
};

const authHeaders = (domain: string, result = "pass") =>
  [
    `Authentication-Results: mx.arkos-systems.fr; spf=${result} smtp.mailfrom=${domain};`,
    ` dkim=${result} header.d=${domain}; dmarc=${result} action=none header.from=${domain}`,
  ].join("\n");

export const MAILS: Mail[] = [
  {
    id: "nuvio",
    internetMessageId: "<20261023104212.7f3a@nuvio-cloud.fr>",
    subject: "Changement de coordonnées bancaires",
    from: { displayName: "Nuvio Cloud", emailAddress: "facturation@nuvio-cloud.fr" },
    to: "Claire Bernard",
    received: { dayOffset: 0, time: "10:42" },
    unread: true,
    body: [
      "Bonjour Madame Bernard,",
      "Suite à la réforme de la facturation électronique, nous changeons d'établissement bancaire. La facture n°2026-114 de 18 400,00 € que vous avez reçue sur votre plateforme reste valable, mais merci d'en effectuer le règlement sur notre nouveau compte (RIB joint).",
      "Les virements vers l'ancien compte ne pourront plus être traités à partir de lundi.",
      "Bien cordialement,",
      "Service facturation\nNuvio Cloud\n12 rue des Entrepreneurs, 69007 Lyon",
    ].join("\n\n"),
    attachments: [
      {
        id: "nuvio-rib",
        name: "Nouveau_RIB_Nuvio_Cloud.pdf",
        contentType: "application/pdf",
        size: 48213,
        url: "/attachments/Nouveau_RIB_Nuvio_Cloud.pdf",
      },
    ],
    internetHeaders: authHeaders("nuvio-cloud.fr"),
  },
  {
    id: "daf",
    internetMessageId: "<20261023101503.11ab@arkos-systems.fr>",
    subject: "Urgent : facture Lumio Data à régler aujourd'hui",
    from: { displayName: "Marc Lefèvre", emailAddress: "m.lefevre@arkos-systems.fr" },
    to: "Claire Bernard",
    received: { dayOffset: 0, time: "10:15" },
    unread: true,
    body: [
      "Claire,",
      "Peux-tu régler aujourd'hui la facture F-2026-219 de Lumio Data (2 350,00 €) ? Elle est échue depuis le 15 et ils nous ont relancés deux fois. Je ne veux pas de pénalités de retard.",
      "Merci,",
      "Marc Lefèvre\nDirecteur administratif et financier\nArkos Systems",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("arkos-systems.fr"),
  },
  {
    // Hameçonnage : faux support informatique qui vole les identifiants, depuis « arkos-systerns.fr » (rn à la place du m).
    id: "mfa",
    internetMessageId: "<20261022113020.77fe@arkos-systerns.fr>",
    subject: "Action requise : votre double authentification expire aujourd'hui",
    from: { displayName: "Support informatique", emailAddress: "support@arkos-systerns.fr" },
    to: "Claire Bernard",
    received: { dayOffset: 0, time: "10:05" },
    unread: true,
    body: [
      "Bonjour Claire,",
      "Dans le cadre de la mise à jour de sécurité, votre double authentification expire aujourd'hui. Pour conserver votre accès à la messagerie et au VPN, renouvelez-la avant 18 h :\nhttps://arkos-systerns.fr/securite/renouvellement",
      "Sans action de votre part, votre compte sera suspendu.",
      "Le support informatique",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("arkos-systerns.fr"),
  },
  {
    id: "muller",
    internetMessageId: "<20261023095801.c2d4@mueller-technik.de>",
    subject: "Rechnung 2026-0388 – neue Bankverbindung",
    from: { displayName: "Müller Technik GmbH – Buchhaltung", emailAddress: "buchhaltung@mueller-technik.de" },
    to: "Claire Bernard",
    received: { dayOffset: 0, time: "09:58" },
    body: [
      "Sehr geehrte Frau Bernard,",
      "anbei erhalten Sie unsere Rechnung 2026-0388. Bitte beachten Sie, dass sich unsere Bankverbindung geändert hat. Die neuen Kontodaten finden Sie auf der Rechnung.",
      "Wir bitten um Überweisung des Betrags bis spätestens Freitag.",
      "Mit freundlichen Grüßen\nBuchhaltung\nMüller Technik GmbH, Köln",
    ].join("\n\n"),
    attachments: [
      {
        id: "muller-invoice",
        name: "Rechnung_2026-0388.pdf",
        contentType: "application/pdf",
        size: 61877,
        url: "/attachments/Rechnung_2026-0388.pdf",
      },
    ],
    internetHeaders: authHeaders("mueller-technik.de"),
  },
  {
    id: "pdg",
    internetMessageId: "<CAF8x2kQ7@mail.gmail.com>",
    subject: "Virement confidentiel",
    from: { displayName: "Jean-Pierre Durand", emailAddress: "jp.durand.pdg@gmail.com" },
    to: "Claire Bernard",
    received: { dayOffset: 0, time: "09:31" },
    body: [
      "Claire,",
      "Je suis en réunion avec nos avocats et je ne peux pas parler. Nous finalisons une acquisition et j'ai besoin que tu passes un virement de 35 000 € aujourd'hui.",
      "C'est strictement confidentiel tant que l'opération n'est pas annoncée : n'en parle à personne, même pas à Marc. Je t'envoie les coordonnées bancaires dans un instant.",
      "Jean-Pierre Durand\nEnvoyé de mon iPhone",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("gmail.com"),
  },
  {
    // Faux conseiller bancaire : banque fictive, domaine qui n'appartient pas à la banque.
    id: "conseiller",
    internetMessageId: "<20261022174512.a1c9@banquehorizon-alerte.com>",
    subject: "Alerte sécurité : opération suspecte sur votre compte professionnel",
    from: { displayName: "Service Sécurité – Banque Horizon", emailAddress: "securite@banquehorizon-alerte.com" },
    to: "Claire Bernard",
    received: { dayOffset: -1, time: "17:45" },
    body: [
      "Madame,",
      "Une opération suspecte de 12 450,00 € a été détectée sur le compte professionnel de Arkos Systems. Pour la bloquer, effectuez immédiatement un virement de sécurité du même montant vers votre compte de protection temporaire :\nIBAN : FR24 1450 8000 0100 9876 5432 110",
      "Votre conseiller vous rappellera dans la journée. Ne contactez pas votre agence : la procédure est automatisée.",
      "Service Sécurité\nBanque Horizon",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("banquehorizon-alerte.com"),
  },
  {
    id: "dubois",
    internetMessageId: "<20261022161044.9e01@lumio-data.fr>",
    subject: "Relance : facture F-2026-219",
    from: { displayName: "Lumio Data", emailAddress: "comptabilite@lumio-data.fr" },
    to: "Claire Bernard",
    received: { dayOffset: -1, time: "16:10" },
    body: [
      "Bonjour,",
      "Sauf erreur de notre part, la facture F-2026-219 de 2 350,00 € arrivée à échéance le 15 octobre reste impayée. Elle est disponible sur votre plateforme de facturation.",
      "Merci de procéder au règlement sur le compte habituel.",
      "Cordialement,\nService comptabilité, Lumio Data",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("lumio-data.fr"),
  },
  {
    // Fausse facture de conseil depuis un domaine sosie : « de1ivery » avec un 1 à la place du l.
    id: "sosie",
    internetMessageId: "<20261023100512.4b2e@de1ivery-partners.fr>",
    subject: "Facture DP-2026-118 – mission d'octobre",
    from: { displayName: "Delivery Partners – Facturation", emailAddress: "facturation@de1ivery-partners.fr" },
    to: "Claire Bernard",
    received: { dayOffset: -1, time: "11:30" },
    body: [
      "Bonjour Madame Bernard,",
      "Veuillez trouver ci-dessous notre facture DP-2026-118 pour la mission d'accompagnement de vos équipes en octobre, d'un montant de 14 400,00 €.",
      "Notre cabinet ayant changé de banque ce mois-ci, merci d'effectuer le règlement sur notre nouveau compte :\nIBAN : FR24 1450 8000 0100 9876 5432 110\nBIC : HRZNFRP1",
      "Le règlement est attendu sous 48 h, conformément à nos conditions.",
      "Cordialement,\nService facturation, Delivery Partners",
    ].join("\n\n"),
    attachments: [],
    // Le fraudeur possède ce domaine : l'authentification passe, c'est le nom qui trompe.
    internetHeaders: authHeaders("de1ivery-partners.fr"),
  },
  {
    id: "news",
    internetMessageId: "<20261022070000.news@lettre-finance-pme.fr>",
    subject: "Votre lettre d'octobre : trésorerie de fin d'année",
    from: { displayName: "Lettre Finance PME", emailAddress: "newsletter@lettre-finance-pme.fr" },
    to: "Claire Bernard",
    received: { dayOffset: -1, time: "07:00" },
    body: [
      "Au sommaire ce mois-ci :",
      "• Préparer sa trésorerie de fin d'année\n• Facturation électronique : le calendrier pour les PME\n• Trois questions à une directrice financière",
      "Bonne lecture,\nLa rédaction",
    ].join("\n\n"),
    attachments: [],
    internetHeaders: authHeaders("lettre-finance-pme.fr"),
  },
];
