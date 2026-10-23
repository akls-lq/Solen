"use client";

import dynamic from "next/dynamic";

// Fluent UI injecte ses styles au rendu dans le navigateur : on évite le rendu serveur pour ne pas avoir de page sans styles.
export const ClientApp = dynamic(() => import("./OutlookApp").then((m) => m.OutlookApp), { ssr: false });
