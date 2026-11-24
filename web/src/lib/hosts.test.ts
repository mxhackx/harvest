import { describe, expect, it } from "vitest";
import { hostRedirect } from "./hosts";

const SITE = "https://hivation.tech";
const APP = "https://app.hivation.tech";
const go = (host: string, path: string, search = "") => hostRedirect(host, path, search, SITE, APP);

describe("hostRedirect", () => {
  it("ne fait rien sans domaine d'application (développement)", () => {
    expect(hostRedirect("localhost:3000", "/dashboard", "", "http://localhost:3000", undefined)).toBeNull();
  });
  it("vitrine : renvoie l'espace connecté et la connexion vers app., en gardant le chemin et la requête", () => {
    expect(go("hivation.tech", "/dashboard/leads/42")).toBe(`${APP}/dashboard/leads/42`);
    expect(go("hivation.tech", "/login")).toBe(`${APP}/login`);
    expect(go("hivation.tech", "/invitation", "?token=abc")).toBe(`${APP}/invitation?token=abc`);
    expect(go("hivation.tech", "/reinitialiser", "?token=abc")).toBe(`${APP}/reinitialiser?token=abc`);
  });
  it("vitrine : garde l'accueil et la documentation", () => {
    expect(go("hivation.tech", "/")).toBeNull();
    expect(go("hivation.tech", "/docs/import")).toBeNull();
  });
  it("application : la racine ouvre le dashboard, la vitrine et la doc repartent sur hivation.tech", () => {
    expect(go("app.hivation.tech", "/")).toBe(`${APP}/dashboard`);
    expect(go("app.hivation.tech", "/docs/import")).toBe(`${SITE}/docs/import`);
    expect(go("app.hivation.tech", "/dashboard")).toBeNull();
    expect(go("app.hivation.tech", "/login")).toBeNull();
  });
  it("n'attrape pas un chemin qui ne fait que commencer pareil", () => {
    expect(go("hivation.tech", "/dashboards")).toBeNull();
  });
  it("autre domaine (prévisualisation, localhost) : jamais de redirection", () => {
    expect(go("hivation-git-x.vercel.app", "/dashboard")).toBeNull();
  });
});
