"use client";

import { useEffect, useState } from "react";
import { Button, Spinner, Tooltip } from "@fluentui/react-components";
import {
  Call20Regular,
  Checkmark16Filled,
  CheckmarkCircle20Filled,
  Dismiss20Regular,
  ErrorCircle20Filled,
  Info16Regular,
  PersonAlert20Regular,
  Pin20Filled,
  Shield20Filled,
  ShieldCheckmark16Filled,
  Warning16Filled,
  Warning20Filled,
} from "@fluentui/react-icons";
import type { Mail } from "@/data/mails";
import type { AnalysisResult } from "@/lib/analyze";
import type { Verdict } from "@/lib/checks";
import styles from "./outlook.module.css";

const STEP_DELAY_MS = 450;

const stepsFor = (mail: Mail) => [
  "Authentification de l'expéditeur",
  ...(mail.attachments.length ? [`Lecture de ${mail.attachments[0].name}`] : []),
  "Comparaison avec le profil fournisseur",
  "Analyse de la demande par l'IA",
];

const VERDICT_UI: Record<Verdict, { title: string; className: string; Icon: typeof ErrorCircle20Filled }> = {
  fraude: { title: "Fraude probable", className: styles.verdictFraude, Icon: ErrorCircle20Filled },
  suspect: { title: "Demande inhabituelle", className: styles.verdictSuspect, Icon: Warning20Filled },
  fiable: { title: "Aucune anomalie", className: styles.verdictFiable, Icon: CheckmarkCircle20Filled },
};

const euros = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}\u00a0€`;

type Props = {
  mail: Mail;
  result?: AnalysisResult;
  error?: string;
  onClose: () => void;
};

export const GardeFouPane = ({ mail, result, error, onClose }: Props) => {
  const steps = stepsFor(mail);
  const stepCount = steps.length;
  const [shownSteps, setShownSteps] = useState(0);
  const [dafNotified, setDafNotified] = useState(false);

  // Rejoue les étapes à chaque mail (le parent remonte ce composant par mail) : la vraie analyse tourne pendant ce temps.
  useEffect(() => {
    const timers = Array.from({ length: stepCount }, (_, i) => setTimeout(() => setShownSteps(i + 1), (i + 1) * STEP_DELAY_MS));
    return () => timers.forEach(clearTimeout);
  }, [stepCount]);

  const done = Boolean(result) && shownSteps >= steps.length;
  // La dernière étape (l'IA) ne se coche qu'à l'arrivée du vrai résultat.
  const checked = result ? shownSteps : Math.min(shownSteps, steps.length - 1);

  return (
    <aside className={styles.addinPane} aria-label="Garde-Fou">
      <header className={styles.addinHeader}>
        <span className={styles.addinTitle}>
          <Shield20Filled className={styles.brandIcon} /> Garde-Fou
        </span>
        <span>
          <Tooltip content="Épinglé" relationship="label">
            <Button appearance="subtle" size="small" icon={<Pin20Filled />} />
          </Tooltip>
          <Tooltip content="Fermer" relationship="label">
            <Button appearance="subtle" size="small" icon={<Dismiss20Regular />} onClick={onClose} />
          </Tooltip>
        </span>
      </header>

      <div className={styles.addinBody}>
        {!done && !error && (
          <ol className={styles.steps}>
            {steps.map((label, i) => (
              <li key={label} className={i < checked ? styles.stepDone : styles.stepPending}>
                {i < checked ? (
                  <Checkmark16Filled className={styles.stepCheck} />
                ) : i === checked ? (
                  <Spinner size="extra-tiny" />
                ) : (
                  <span className={styles.stepDot} />
                )}
                {label}
              </li>
            ))}
          </ol>
        )}

        {error && <p className={styles.paneError}>Analyse indisponible pour le moment. Réessayez dans un instant.</p>}

        {done && result && <Verdict result={result} dafNotified={dafNotified} onNotifyDaf={() => setDafNotified(true)} />}
      </div>
    </aside>
  );
};

const Verdict = ({
  result,
  dafNotified,
  onNotifyDaf,
}: {
  result: AnalysisResult;
  dafNotified: boolean;
  onNotifyDaf: () => void;
}) => {
  const ui = VERDICT_UI[result.verdict];
  const alert = result.verdict !== "fiable";
  return (
    <div className={styles.verdictWrap}>
      <section className={`${styles.verdictCard} ${ui.className}`}>
        <ui.Icon />
        <div>
          <strong>{ui.title}</strong>
          {alert && result.amount !== undefined && <span className={styles.amount}>{euros(result.amount)} en jeu</span>}
        </div>
      </section>

      <section className={styles.paneSection}>
        <h3>Expéditeur</h3>
        <p className={styles.senderLine}>
          {result.sender.verified ? (
            <span className={styles.badgeVerified}>
              <ShieldCheckmark16Filled /> Vérifié
            </span>
          ) : (
            <span className={styles.badgeUnverified}>Non vérifié</span>
          )}
          {result.sender.label}
        </p>
      </section>

      {result.demande && (
        <section className={styles.paneSection}>
          <h3>La demande</h3>
          <p>{result.demande}</p>
          {result.langue && !/fran/i.test(result.langue) && (
            <p className={styles.muted}>Mail rédigé en {result.langue}, analysé en français.</p>
          )}
        </section>
      )}

      {result.reasons.length > 0 && (
        <section className={styles.paneSection}>
          <h3>{alert ? "Pourquoi" : "Ce qui a été vérifié"}</h3>
          <ul className={styles.reasons}>
            {result.reasons.map((r) => (
              <li key={r.text}>
                {r.severity === "fiable" ? (
                  <Checkmark16Filled className={styles.okIcon} />
                ) : r.severity === "fraude" ? (
                  <Warning16Filled className={styles.badIcon} />
                ) : (
                  <Info16Regular className={styles.warnIcon} />
                )}
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.techniques.length > 0 && (
        <section className={styles.paneSection}>
          <h3>Techniques de manipulation repérées</h3>
          <div className={styles.tags}>
            {result.techniques.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {result.callback && (
        <section className={styles.paneSection}>
          <h3>Que faire</h3>
          <p>
            Ne payez pas. Appelez <strong>{result.callback.who}</strong> au{" "}
            <strong className={styles.phone}>{result.callback.phone}</strong>.
          </p>
          <p className={styles.muted}>Numéro déjà connu de l’entreprise, jamais celui écrit dans le mail.</p>
          {result.callback.questions.length > 0 && (
            <>
              <h4>Questions à poser</h4>
              <ol className={styles.questions}>
                {result.callback.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </>
          )}
          <div className={styles.paneActions}>
            <Button appearance="primary" icon={<Call20Regular />} as="a" href={`tel:${result.callback.phone.replace(/\s/g, "")}`}>
              Appeler
            </Button>
            <Button icon={<PersonAlert20Regular />} onClick={onNotifyDaf} disabled={dafNotified}>
              {dafNotified ? "DAF prévenu" : "Prévenir le DAF"}
            </Button>
          </div>
          {dafNotified && <p className={styles.muted}>Marc Lefèvre a reçu un résumé de l&apos;alerte.</p>}
        </section>
      )}

      <footer className={styles.paneFooter}>
        IBAN masqués avant l&apos;analyse par l&apos;IA. Seul le code compare les coordonnées bancaires.{" "}
        <a href="/fournisseurs" target="_blank" rel="noreferrer">
          Profils fournisseurs
        </a>
      </footer>
    </div>
  );
};
