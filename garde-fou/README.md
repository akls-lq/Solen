# Solen

Démo : une boîte mail type Outlook où le module Solen signale les fraudes au virement (changement de RIB, faux président).

## Lancer

```bash
npm install
npm run dev            # http://localhost:3000
```

- Clé Mistral : créer `.env.local` avec `MISTRAL_API_KEY=...`. Sans clé, ou si Mistral ne répond pas, les analyses de secours de `src/data/fallback.ts` prennent le relais.
- `SOLEN_AI=secours npm run dev` : n'appelle jamais Mistral (pour développer sans consommer de crédits).
- `Alt+Maj+G` : installe ou retire Solen de la boîte mail (démo avant / après).
- `/fournisseurs` : profils fournisseurs (IBAN masqués).
- `npm test` : tests des contrôles (IBAN, expéditeur, montants, verdict).
- `node scripts/make-attachments.mjs` : régénère les PDF de démo.

## Qui décide quoi

- Le code : authentification de l'expéditeur (SPF, DKIM, DMARC), domaine sosie, usurpation d'un dirigeant, comparaison de l'IBAN avec le profil fournisseur, montant habituel.
- Mistral Small : comprend la demande, la langue et les techniques de manipulation, puis explique en français. Il ne reçoit jamais un IBAN ni un numéro de compte, et son verdict ne peut qu'aggraver celui du code.

Données 100 % fictives.
