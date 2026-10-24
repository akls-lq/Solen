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
import { BADGES, level, POINTS_PER_LEVEL, type Reflex, type VigilanceState } from "./vigilance";

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
  vigilance: VigilanceState;
  onReflex: (reflex: Reflex) => void;
  // Un module ne peut rien dessiner hors de son volet : la notification de badge s'affiche ici.
  notice?: string;
};

export const SolenPane = ({ mail, result, error, onClose, vigilance, onReflex, notice }: Props) => {
  const steps = stepsFor(mail);
  const stepCount = steps.length;
  const [shownSteps, setShownSteps] = useState(0);
  const isDone = (reflex: Reflex) => vigilance.done.includes(`${mail.id}:${reflex}`);

  // Rejoue les étapes à chaque mail (le parent remonte ce composant par mail) : la vraie analyse tourne pendant ce temps.
  useEffect(() => {
    const timers = Array.from({ length: stepCount }, (_, i) => setTimeout(() => setShownSteps(i + 1), (i + 1) * STEP_DELAY_MS));
    return () => timers.forEach(clearTimeout);
  }, [stepCount]);

  const done = Boolean(result) && shownSteps >= steps.length;
  // La dernière étape (l'IA) ne se coche qu'à l'arrivée du vrai résultat.
  const checked = result ? shownSteps : Math.min(shownSteps, steps.length - 1);

  return (
    <aside className={styles.addinPane} aria-label="Solen">
      <header className={styles.addinHeader}>
        <span className={styles.addinTitle}>
          <Shield20Filled className={styles.brandIcon} /> Solen
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
        {notice && (
          <div className={styles.notice} role="status">
            <ShieldCheckmark16Filled />
            <span>
              <strong>Réflexe acquis</strong> {notice}
            </span>
          </div>
        )}
        <VigilanceCard vigilance={vigilance} />

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

        {done && result && <Verdict result={result} isDone={isDone} onReflex={onReflex} />}
      </div>
    </aside>
  );
};

const VigilanceCard = ({ vigilance }: { vigilance: VigilanceState }) => {
  const [open, setOpen] = useState(false);
  const stopped = Object.keys(vigilance.protectedAmounts).length;
  const saved = Object.values(vigilance.protectedAmounts).reduce((a, b) => a + b, 0);
  return (
    <section className={styles.vigilance}>
      <button type="button" className={styles.vigilanceHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          <strong>Vigilance</strong> · niveau {level(vigilance.points)} · {vigilance.points} pts
        </span>
        <span className={styles.muted}>
          Réflexes {vigilance.badges.length}/{BADGES.length}
        </span>
      </button>
      <div className={styles.progress}>
        <span style={{ transform: `scaleX(${(vigilance.points % POINTS_PER_LEVEL) / POINTS_PER_LEVEL})` }} />
      </div>
      <p className={styles.muted}>
        {stopped === 0
          ? "Chaque bon réflexe face à une fraude vous rapporte des points."
          : `${stopped} fraude${stopped > 1 ? "s" : ""} déjouée${stopped > 1 ? "s" : ""} · ${euros(saved)} protégés`}
      </p>
      {open && (
        <ul className={styles.badges}>
          {BADGES.map((b) => {
            const unlocked = vigilance.badges.includes(b.id);
            return (
              <li key={b.id} className={unlocked ? styles.badgeOn : styles.badgeOff}>
                {unlocked ? <Checkmark16Filled /> : <span className={styles.stepDot} />}
                <span>
                  {b.label}
                  {!unlocked && <span className={styles.badgeHint}>{b.hint}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const Verdict = ({
  result,
  isDone,
  onReflex,
}: {
  result: AnalysisResult;
  isDone: (reflex: Reflex) => boolean;
  onReflex: (reflex: Reflex) => void;
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
        {result.sender.lookalike && (
          <div className={styles.lookalike}>
            <span className={styles.lookalikeAddress}>
              {result.sender.lookalike.local}@
              {result.sender.lookalike.segments.map((s, i) => (s.odd ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
            </span>
            <span className={styles.muted}>
              imite <span className={styles.lookalikeAddress}>{result.sender.lookalike.imitates}</span>
            </span>
          </div>
        )}
      </section>

      {result.demande && (
        <section className={styles.paneSection}>
          <h3>La demande</h3>
          <p>{result.demande}</p>
          {result.langue && !/fran/i.test(result.langue) && (
            <p className={styles.muted}>Mail en {result.langue}, analysé en français.</p>
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
                <span>
                  {r.text} <span className={styles.provenance}>{r.source === "code" ? "Règle" : "IA"}</span>
                </span>
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
            {result.amount !== undefined ? "Ne payez pas." : "Ne cliquez pas."} Appelez <strong>{result.callback.who}</strong> au{" "}
            <strong className={styles.phone}>{result.callback.phone}</strong> (numéro connu, pas celui du mail).
          </p>
          {result.callback.questions.length > 0 && (
            <details className={styles.questionsBox}>
              <summary>Questions à poser ({result.callback.questions.length})</summary>
              <ol className={styles.questions}>
                {result.callback.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </details>
          )}
          <div className={styles.paneActions}>
            <Button appearance="primary" icon={<Call20Regular />} onClick={() => onReflex("contre-appel")} disabled={isDone("contre-appel")}>
              {isDone("contre-appel") ? "Contre-appel noté" : "Appeler"}
            </Button>
            <Button icon={<PersonAlert20Regular />} onClick={() => onReflex("daf")} disabled={isDone("daf")}>
              {isDone("daf") ? "DAF prévenu" : "Prévenir le DAF"}
            </Button>
          </div>
          {isDone("daf") && <p className={styles.muted}>Résumé envoyé à Marc Lefèvre.</p>}
        </section>
      )}

      {!alert && (
        <section className={styles.paneSection}>
          <Button size="small" onClick={() => onReflex("signalement")} disabled={isDone("signalement")}>
            {isDone("signalement") ? "Signalement transmis" : "Ce mail me semble suspect"}
          </Button>
          {isDone("signalement") && (
            <p className={styles.muted}>Merci : votre signalement sera vérifié et aidera Solen à progresser.</p>
          )}
        </section>
      )}

      <footer className={styles.paneFooter}>
        L&apos;IA ne voit jamais les IBAN.{" "}
        <a href="/fournisseurs" target="_blank" rel="noreferrer">
          Profils fournisseurs
        </a>
      </footer>
    </div>
  );
};
