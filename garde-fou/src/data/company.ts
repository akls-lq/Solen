// Données 100 % fictives. En V2, les profils viendraient de la banque et du logiciel comptable, jamais d'un mail.

export type Supplier = {
  id: string;
  name: string;
  domain: string;
  iban: string;
  phone: string;
  country: string;
  usualAmount: { min: number; max: number };
  paymentsToIban: number;
  since: string;
};

export type Person = { name: string; role: string; email: string; phone: string; aliases: string[] };

export const COMPANY = { name: "Arkos Systems", domain: "arkos-systems.fr" };

export const MAILBOX_OWNER = { name: "Claire Bernard", email: "c.bernard@arkos-systems.fr" };

export const DIRECTORY: Person[] = [
  {
    name: "Jean-Pierre Durand",
    role: "PDG",
    email: "jp.durand@arkos-systems.fr",
    phone: "01 84 25 10 01",
    aliases: ["jean-pierre durand", "j.-p. durand", "jp durand", "j.p. durand"],
  },
  {
    name: "Marc Lefèvre",
    role: "DAF",
    email: "m.lefevre@arkos-systems.fr",
    phone: "01 84 25 10 12",
    aliases: ["marc lefèvre", "marc lefevre", "m. lefèvre"],
  },
];

// Contacte le support informatique quand une adresse imite le domaine de l'entreprise.
export const IT_SUPPORT: Person = {
  name: "Support informatique",
  role: "DSI",
  email: "support@arkos-systems.fr",
  phone: "01 84 25 10 30",
  aliases: [],
};

export const SUPPLIERS: Supplier[] = [
  {
    id: "dubois",
    name: "Lumio Data",
    domain: "lumio-data.fr",
    iban: "FR3730004008210001234510933",
    phone: "01 84 60 12 45",
    country: "France",
    usualAmount: { min: 1800, max: 2600 },
    paymentsToIban: 14,
    since: "2021",
  },
  {
    id: "nuvio",
    name: "Nuvio Cloud",
    domain: "nuvio-cloud.fr",
    iban: "FR0310278060410002098765530",
    phone: "04 72 18 52 30",
    country: "France",
    usualAmount: { min: 15000, max: 20000 },
    paymentsToIban: 22,
    since: "2019",
  },
  {
    id: "delivery",
    name: "Delivery Partners",
    domain: "delivery-partners.fr",
    iban: "FR0930066109470001045678941",
    phone: "01 84 70 22 15",
    country: "France",
    usualAmount: { min: 12000, max: 16000 },
    paymentsToIban: 11,
    since: "2023",
  },
  {
    id: "muller",
    name: "Müller Technik GmbH",
    domain: "mueller-technik.de",
    iban: "DE47370400440532013077",
    phone: "+49 221 555 0142",
    country: "Allemagne",
    usualAmount: { min: 8000, max: 11000 },
    paymentsToIban: 9,
    since: "2022",
  },
];
