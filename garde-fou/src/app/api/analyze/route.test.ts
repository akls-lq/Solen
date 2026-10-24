import { describe, expect, it, vi } from "vitest";
import * as ai from "@/lib/ai";
import { POST } from "./route";

const request = (ip: string, body: unknown) =>
  new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const newsletter = {
  internetMessageId: "<news@exemple.fr>",
  subject: "Lettre d'octobre",
  fromName: "Lettre",
  fromEmail: "news@exemple.fr",
  headers: "",
  body: "Au sommaire ce mois-ci.",
  attachments: [],
};

describe("API d'analyse", () => {
  it("bloque une adresse IP qui enchaîne les demandes (vider les crédits, tester ses faux mails)", async () => {
    vi.spyOn(ai, "analyzeWithMistral");
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await POST(request("203.0.113.7", newsletter))).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    // Une autre adresse n'est pas pénalisée.
    expect((await POST(request("203.0.113.8", newsletter))).status).toBe(200);
  });

  it("refuse un mail géant qui ferait exploser le coût de l'analyse", async () => {
    const response = await POST(request("203.0.113.9", { ...newsletter, body: "x".repeat(60_000) }));
    expect(response.status).toBe(413);
  });
});
