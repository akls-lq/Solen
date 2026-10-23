// Tout ce qui touche à l'IBAN reste dans le code : l'IA ne reçoit que des jetons [IBAN_1], [IBAN_2]…

export const normalizeIban = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();

// Contrôle ISO 13616 (modulo 97) : écarte les suites de caractères qui ressemblent à un IBAN sans en être un.
export const isValidIban = (raw: string) => {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
};

type IbanMatch = { start: number; end: number; iban: string };

// Une regex seule avalerait le mot suivant (« … 0933 BIC ») : on lit jusqu'à 34 caractères
// puis on garde le plus long préfixe dont le modulo 97 est valide.
const scanIbans = (text: string): IbanMatch[] => {
  const matches: IbanMatch[] = [];
  const starts = /(?<![A-Za-z0-9])[A-Za-z]{2}\d{2}/g;
  let found: RegExpExecArray | null;
  while ((found = starts.exec(text))) {
    const chars: string[] = [];
    const ends: number[] = [];
    for (let j = found.index; j < text.length && chars.length < 34; j++) {
      const ch = text[j];
      if (/[A-Za-z0-9]/.test(ch)) {
        chars.push(ch.toUpperCase());
        ends.push(j + 1);
      } else if (ch !== " " || text[j - 1] === " ") break;
    }
    for (let len = chars.length; len >= 15; len--) {
      const iban = chars.slice(0, len).join("");
      if (isValidIban(iban)) {
        matches.push({ start: found.index, end: ends[len - 1], iban });
        starts.lastIndex = ends[len - 1];
        break;
      }
    }
  }
  return matches;
};

export const findIbans = (text: string) => [...new Set(scanIbans(text).map((m) => m.iban))];

export const maskIban = (raw: string) => {
  const iban = normalizeIban(raw);
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
};

// Remplace chaque IBAN par un jeton avant l'envoi à l'IA. La même table sert pour le mail et ses pièces jointes.
export const redactIbans = (text: string, tokens: Map<string, string>) => {
  let out = "";
  let cursor = 0;
  for (const { start, end, iban } of scanIbans(text)) {
    if (!tokens.has(iban)) tokens.set(iban, `[IBAN_${tokens.size + 1}]`);
    out += text.slice(cursor, start) + tokens.get(iban);
    cursor = end;
  }
  return out + text.slice(cursor);
};
