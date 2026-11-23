import { describe, expect, it } from "vitest";
import { connectionOptions, isTransactionPooler } from "./connection.js";
import { oauthCookiePath } from "../config.js";

describe("connectionOptions", () => {
  it("base locale : pas de SSL, requêtes préparées", () => {
    for (const url of ["postgres://harvest:harvest@localhost:54329/harvest", "postgres://u:p@127.0.0.1:5432/db"]) {
      expect(connectionOptions(url)).toEqual({ prepare: true, ssl: false });
    }
  });
  it("Supabase (session pooler, port 5432) : SSL exigé, requêtes préparées", () => {
    const url = "postgresql://postgres.abcd:example-password@aws-0-eu-west-3.pooler.supabase.com:5432/postgres";
    expect(connectionOptions(url)).toEqual({ prepare: true, ssl: "require" });
  });
  it("Supabase (pooler en mode transaction, port 6543) : SSL exigé et pas de requêtes préparées", () => {
    const url = "postgresql://postgres.abcd:example-password@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";
    expect(connectionOptions(url)).toEqual({ prepare: false, ssl: "require" });
    expect(isTransactionPooler(url)).toBe(true);
  });
  it("un hôte nommé « localhost » dans le mot de passe ne trompe pas la détection", () => {
    expect(connectionOptions("postgres://u:example-localhost@db.example.com:5432/x").ssl).toBe("require");
  });
  it("seul le port 6543 est un pooler en mode transaction", () => {
    expect(isTransactionPooler("postgres://u:p@h:5432/db")).toBe(false);
  });
});

describe("oauthCookiePath", () => {
  it("API à la racine : /auth", () => {
    expect(oauthCookiePath("https://harvest-api.onrender.com")).toBe("/auth");
    expect(oauthCookiePath("http://localhost:4000")).toBe("/auth");
  });
  it("API exposée sous un préfixe : le cookie suit le préfixe, sinon il n'est jamais renvoyé", () => {
    expect(oauthCookiePath("https://harvest.vercel.app/api")).toBe("/api/auth");
    expect(oauthCookiePath("https://harvest.vercel.app/api/")).toBe("/api/auth");
  });
});
