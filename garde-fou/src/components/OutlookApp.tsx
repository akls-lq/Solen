"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, FluentProvider, Tooltip, webLightTheme } from "@fluentui/react-components";
import {
  Alert20Regular,
  Apps24Regular,
  Archive20Regular,
  ArrowForward20Regular,
  ArrowReply20Regular,
  ArrowReplyAll20Regular,
  Attach16Regular,
  Calendar24Regular,
  CheckboxChecked24Regular,
  ChevronDown16Regular,
  Delete20Regular,
  DocumentPdf24Filled,
  Drafts20Regular,
  ErrorCircle20Filled,
  Filter20Regular,
  Flag20Regular,
  FolderProhibited20Regular,
  Grid20Regular,
  Info20Regular,
  Mail24Filled,
  MailInbox20Regular,
  MoreHorizontal20Regular,
  Note20Regular,
  People24Regular,
  QuestionCircle20Regular,
  Search20Regular,
  Send20Regular,
  Settings20Regular,
  Shield20Filled,
  ShieldError20Regular,
} from "@fluentui/react-icons";
import { MAILBOX_OWNER } from "@/data/company";
import { MAILS, type Mail } from "@/data/mails";
import type { AnalysisResult } from "@/lib/analyze";
import { SolenPane } from "./SolenPane";
import { applyReflex, BADGES, EMPTY_VIGILANCE, type BadgeId, type Reflex, type VigilanceState } from "./vigilance";
import { analyze } from "./mailClient";
import styles from "./outlook.module.css";

const STORAGE_KEY = "solen-installe";
// Touches 1 à 6 : ouvrent les mails dans l'ordre de la démo.
const DEMO_ORDER = ["nuvio", "mfa", "pdg", "daf", "conseiller", "sosie"];
const VIGILANCE_KEY = "solen-vigilance";

const loadVigilance = (): VigilanceState => {
  try {
    const saved = localStorage.getItem(VIGILANCE_KEY);
    return saved ? { ...EMPTY_VIGILANCE, ...JSON.parse(saved) } : EMPTY_VIGILANCE;
  } catch {
    return EMPTY_VIGILANCE;
  }
};

const saveVigilance = (state: VigilanceState) => {
  try {
    localStorage.setItem(VIGILANCE_KEY, JSON.stringify(state));
  } catch {}
};

const dateOf = (mail: Mail) => {
  const d = new Date();
  d.setDate(d.getDate() + mail.received.dayOffset);
  const [h, m] = mail.received.time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

const listDate = (mail: Mail) =>
  mail.received.dayOffset === 0
    ? mail.received.time
    : dateOf(mail).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

const fullDate = (mail: Mail) =>
  `${dateOf(mail).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} ${mail.received.time}`;

const preview = (mail: Mail) => mail.body.replace(/\s+/g, " ").slice(0, 110);

const kb = (size: number) => `${Math.round(size / 1024)} Ko`;

export const OutlookApp = () => {
  const [selectedId, setSelectedId] = useState(MAILS[0].id);
  const [read, setRead] = useState<Set<string>>(new Set([MAILS[0].id]));
  // Composant rendu uniquement dans le navigateur (ssr: false) : localStorage est disponible ici.
  const [installed, setInstalled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // Désépinglé au chargement : aucune analyse (ni appel à Mistral) tant qu'on n'appuie pas sur P ou sur le bouton Solen.
  const [paneOpen, setPaneOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vigilance, setVigilance] = useState<VigilanceState>(loadVigilance);
  const [toast, setToast] = useState<BadgeId | null>(null);

  const mail = MAILS.find((m) => m.id === selectedId)!;

  // Interrupteur caché pour la démo « avant / après » : Alt+Maj+G. Le jury ne le voit pas.
  useEffect(() => {
    // Raccourcis de démo, invisibles pour le jury. L'app n'a aucun champ de saisie, une seule touche suffit.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea")) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        setInstalled((v) => {
          try {
            localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
          } catch {}
          return !v;
        });
        setPaneOpen(true);
        setDismissed(new Set());
      }
      if (key === "r") {
        setVigilance(EMPTY_VIGILANCE);
        saveVigilance(EMPTY_VIGILANCE);
      }
      if (key === "f") window.open("/fournisseurs", "_blank");
      // P : épingle ou désépingle le volet. Désépinglé, Solen n'analyse plus rien (utile avant la démo).
      if (key === "p") setPaneOpen((v) => !v);
      const demoMail = DEMO_ORDER[Number(key) - 1];
      if (demoMail) {
        setSelectedId(demoMail);
        setRead((prev) => new Set(prev).add(demoMail));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Comme dans Outlook, le module ne tourne que si son volet est ouvert (épinglé) : volet fermé, aucun appel à l'IA.
    if (!installed || !paneOpen) return;
    let cancelled = false;
    analyze(mail)
      .then((r) => !cancelled && setResults((prev) => ({ ...prev, [mail.id]: r })))
      .catch((e: Error) => !cancelled && setErrors((prev) => ({ ...prev, [mail.id]: e.message })));
    return () => {
      cancelled = true;
    };
  }, [installed, paneOpen, mail]);

  const onReflex = (reflex: Reflex) => {
    const r = results[mail.id];
    if (!r) return;
    const { state, unlocked } = applyReflex(vigilance, {
      mailId: mail.id,
      reflex,
      alert: r.verdict !== "fiable",
      amount: r.amount,
      lookalike: Boolean(r.sender.lookalike),
      impersonation: r.sender.kind === "impersonation",
    });
    setVigilance(state);
    saveVigilance(state);
    if (unlocked.length) {
      setToast(unlocked[unlocked.length - 1]);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const select = (id: string) => {
    setSelectedId(id);
    setRead((prev) => new Set(prev).add(id));
  };

  const groups = useMemo(
    () => [
      { label: "Aujourd'hui", mails: MAILS.filter((m) => m.received.dayOffset === 0) },
      { label: "Hier", mails: MAILS.filter((m) => m.received.dayOffset === -1) },
    ],
    [],
  );

  const unreadCount = MAILS.filter((m) => m.unread && !read.has(m.id)).length;
  const result = results[mail.id];
  // Un module ne peut afficher sa notification que s'il tourne, c'est-à-dire volet épinglé et ouvert.
  const showInfobar = installed && paneOpen && result && !dismissed.has(mail.id);

  return (
    <FluentProvider theme={webLightTheme} className={styles.root}>
      <header className={styles.topBar}>
        <span className={styles.waffle}>
          <Grid20Regular />
        </span>
        <span className={styles.productName}>Outlook</span>
        <div className={styles.search}>
          <Search20Regular />
          <span>Rechercher</span>
        </div>
        <div className={styles.topIcons}>
          <Alert20Regular />
          <Settings20Regular />
          <QuestionCircle20Regular />
          <Avatar name={MAILBOX_OWNER.name} size={32} color="colorful" />
        </div>
      </header>

      <div className={styles.shell}>
        <nav className={styles.appRail} aria-label="Applications">
          <span className={styles.railActive}>
            <Mail24Filled />
          </span>
          <Calendar24Regular />
          <People24Regular />
          <CheckboxChecked24Regular />
          <Apps24Regular />
        </nav>

        <div className={styles.main}>
          <div className={styles.ribbonTabs}>
            <span className={styles.ribbonTabActive}>Accueil</span>
            <span>Afficher</span>
            <span>Aide</span>
          </div>
          <div className={styles.ribbon}>
            <Button appearance="primary" size="small">
              Nouveau courrier
            </Button>
            <span className={styles.ribbonSep} />
            <Button appearance="subtle" size="small" icon={<Delete20Regular />}>
              Supprimer
            </Button>
            <Button appearance="subtle" size="small" icon={<Archive20Regular />}>
              Archiver
            </Button>
            <Button appearance="subtle" size="small" icon={<ShieldError20Regular />}>
              Signaler
            </Button>
            <span className={styles.ribbonSep} />
            <Button appearance="subtle" size="small" icon={<ArrowReply20Regular />}>
              Répondre
            </Button>
            <Button appearance="subtle" size="small" icon={<ArrowReplyAll20Regular />}>
              Répondre à tous
            </Button>
            <Button appearance="subtle" size="small" icon={<ArrowForward20Regular />}>
              Transférer
            </Button>
            <Button appearance="subtle" size="small" icon={<Flag20Regular />}>
              Indicateur
            </Button>
            {installed && (
              <>
                <span className={styles.ribbonSep} />
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Shield20Filled className={styles.brandIcon} />}
                  onClick={() => setPaneOpen(true)}
                >
                  Solen
                </Button>
              </>
            )}
            <Button appearance="subtle" size="small" icon={<MoreHorizontal20Regular />} aria-label="Plus d'options" />
          </div>

          <div className={styles.panes}>
            <nav className={styles.folderPane} aria-label="Dossiers">
              <div className={styles.folderAccount}>
                <ChevronDown16Regular /> {MAILBOX_OWNER.email}
              </div>
              <a className={styles.folderActive}>
                <MailInbox20Regular /> Boîte de réception {unreadCount > 0 && <b>{unreadCount}</b>}
              </a>
              <a>
                <FolderProhibited20Regular /> Courrier indésirable
              </a>
              <a>
                <Drafts20Regular /> Brouillons
              </a>
              <a>
                <Send20Regular /> Éléments envoyés
              </a>
              <a>
                <Delete20Regular /> Éléments supprimés
              </a>
              <a>
                <Archive20Regular /> Archive
              </a>
              <a>
                <Note20Regular /> Notes
              </a>
            </nav>

            <section className={styles.messageList} aria-label="Boîte de réception">
              <div className={styles.listHeader}>
                <div className={styles.listTabs}>
                  <span className={styles.listTabActive}>Prioritaire</span>
                  <span>Autres</span>
                </div>
                <Filter20Regular />
              </div>
              {groups.map((g) => (
                <div key={g.label}>
                  <div className={styles.groupLabel}>{g.label}</div>
                  {g.mails.map((m) => {
                    const unread = m.unread && !read.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`${styles.listItem} ${m.id === selectedId ? styles.listItemSelected : ""} ${unread ? styles.listItemUnread : ""}`}
                        onClick={() => select(m.id)}
                      >
                        <Avatar name={m.from.displayName} size={32} color="colorful" />
                        <span className={styles.itemBody}>
                          <span className={styles.itemTop}>
                            <span className={styles.itemFrom}>{m.from.displayName}</span>
                            <span className={styles.itemDate}>{listDate(m)}</span>
                          </span>
                          <span className={styles.itemSubject}>
                            {m.attachments.length > 0 && <Attach16Regular />}
                            <span className={styles.ellipsis}>{m.subject}</span>
                          </span>
                          <span className={styles.itemPreview}>{preview(m)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </section>

            <article className={styles.readingPane} aria-label="Volet de lecture">
              <h1 className={styles.subject}>{mail.subject}</h1>
              <div className={styles.messageCard}>
                <div className={styles.messageHeader}>
                  <Avatar name={mail.from.displayName} size={40} color="colorful" />
                  <div className={styles.messageMeta}>
                    <div>
                      <strong>{mail.from.displayName}</strong>{" "}
                      <span className={styles.address}>&lt;{mail.from.emailAddress}&gt;</span>
                    </div>
                    <div className={styles.muted}>À : {mail.to}</div>
                  </div>
                  <div className={styles.messageActions}>
                    <Tooltip content="Répondre" relationship="label">
                      <Button appearance="subtle" size="small" icon={<ArrowReply20Regular />} />
                    </Tooltip>
                    <Tooltip content="Répondre à tous" relationship="label">
                      <Button appearance="subtle" size="small" icon={<ArrowReplyAll20Regular />} />
                    </Tooltip>
                    <Tooltip content="Transférer" relationship="label">
                      <Button appearance="subtle" size="small" icon={<ArrowForward20Regular />} />
                    </Tooltip>
                    <div className={styles.muted}>{fullDate(mail)}</div>
                  </div>
                </div>

                {/* Notification de module (ErrorMessage / InformationalMessage) : 150 caractères au plus,
                    style imposé par Outlook, et seule l'action « Ignorer » est permise en lecture. */}
                {showInfobar && (
                  <div
                    className={`${styles.infobar} ${result.verdict === "fiable" ? styles.infobarInfo : styles.infobarError}`}
                    role="status"
                  >
                    {result.verdict === "fiable" ? <Info20Regular /> : <ErrorCircle20Filled />}
                    <span className={styles.infobarText}>{result.infobar}</span>
                    <Button size="small" onClick={() => setDismissed((prev) => new Set(prev).add(mail.id))}>
                      Ignorer
                    </Button>
                  </div>
                )}

                {mail.attachments.length > 0 && (
                  <div className={styles.attachments}>
                    {mail.attachments.map((a) => (
                      <a key={a.id} className={styles.attachment} href={a.url} target="_blank" rel="noreferrer">
                        <DocumentPdf24Filled className={styles.pdfIcon} />
                        <span>
                          <span className={styles.attachmentName}>{a.name}</span>
                          <span className={styles.muted}>{kb(a.size)}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                <div className={styles.messageBody}>{mail.body}</div>
              </div>
            </article>

            {installed && paneOpen && (
              <SolenPane
                key={mail.id}
                mail={mail}
                result={result}
                error={errors[mail.id]}
                onClose={() => setPaneOpen(false)}
                vigilance={vigilance}
                onReflex={onReflex}
                notice={toast ? BADGES.find((b) => b.id === toast)?.label : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </FluentProvider>
  );
};
