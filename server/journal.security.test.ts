import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("journal security constitution", () => {
  it("keeps journal procedures behind the protected boundary", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("journal: router({");
    expect(routers).toContain("create: protectedProcedure");
    expect(routers).toContain("list: protectedProcedure");
    expect(routers).toContain("delete: protectedProcedure");
    expect(routers).toContain("insights: protectedProcedure");
  });

  it("enforces owner predicates for reads and deletes", () => {
    const db = read("server/db.ts");
    expect(db).toContain("eq(journalEntries.ownerId, ownerId)");
    expect(db).toContain("and(eq(journalEntries.ownerId, ownerId), eq(journalEntries.id, id))");
  });

  it("bounds prompt and thread inputs at the RPC boundary", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("max(5000)");
    expect(routers).toContain("max(8)");
  });

  it("does not embed credential-shaped literals", () => {
    const ai = read("server/journalAi.ts");
    expect(ai).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(ai).not.toMatch(/-----BEGIN (?:RSA )?PRIVATE KEY-----/);
    expect(ai).toContain("secretmanager.googleapis.com");
    expect(ai).toContain("gemini-api-key");
  });
});
