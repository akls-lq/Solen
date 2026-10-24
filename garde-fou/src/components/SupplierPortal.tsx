"use client";

import { useState } from "react";
import { Button, FluentProvider, webLightTheme } from "@fluentui/react-components";
import { ArrowSync20Regular, Shield20Filled, ShieldCheckmark16Filled } from "@fluentui/react-icons";
import styles from "./portal.module.css";

export type SupplierRow = {
  id: string;
  name: string;
  domain: string;
  maskedIban: string;
  phone: string;
  usualAmount: string;
  trust: "confirmé" | "nouveau";
  learnedFrom: string;
};

export const SupplierPortal = ({ companyName, rows }: { companyName: string; rows: SupplierRow[] }) => {
  // Démo : la synchronisation avec le logiciel comptable est simulée (V2).
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }, 1200);
  };

  return (
    <FluentProvider theme={webLightTheme} className={styles.root}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Shield20Filled /> Solen
        </span>
        <span className={styles.company}>{companyName} · Espace entreprise</span>
      </header>
      <main className={styles.main}>
        <div className={styles.titleRow}>
          <div>
            <h1>Profils fournisseurs</h1>
            <p>
              Appris à partir des paiements déjà enregistrés dans votre logiciel comptable. Un mail ne peut jamais modifier un
              profil.
            </p>
          </div>
          <div className={styles.sync}>
            <Button icon={<ArrowSync20Regular />} onClick={sync} disabled={syncing}>
              {syncing ? "Synchronisation…" : "Synchroniser avec le logiciel comptable"}
            </Button>
            {syncedAt && <span>Synchronisé à {syncedAt}</span>}
          </div>
        </div>
        <div className={styles.tableBox}>
          <table>
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Domaine</th>
                <th>IBAN de référence</th>
                <th>Téléphone</th>
                <th>Montant habituel</th>
                <th>Confiance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={styles.name}>{r.name}</td>
                  <td className={styles.mono}>{r.domain}</td>
                  <td className={styles.mono}>{r.maskedIban}</td>
                  <td className={styles.mono}>{r.phone}</td>
                  <td>{r.usualAmount}</td>
                  <td>
                    <span className={r.trust === "confirmé" ? styles.trustOk : styles.trustNew}>
                      {r.trust === "confirmé" && <ShieldCheckmark16Filled />}
                      {r.trust === "confirmé" ? "Confirmé" : "Nouveau"}
                    </span>
                    <span className={styles.learned}>{r.learnedFrom}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </FluentProvider>
  );
};
