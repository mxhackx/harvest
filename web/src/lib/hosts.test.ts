import { describe, expect, it } from "vitest";
import { hostRedirect } from "./hosts";

const SITE = "https://www.hivation.tech";
const APP = "https://app.hivation.tech";
const go = (host: string, path: string, search = "") => hostRedirect(host, path, search, SITE, APP);

describe("hostRedirect", () => {
  it("ne fait rien sans domaine d'application (développement)", () => {
    expect(hostRedirect("localhost:3000", "/dashboard", "", "http://localhost:3000", undefined)).toBeNull();
  });
  it("vitrine : renvoie l'espace connecté et la connexion vers app., en gardant le chemin et la requête", () => {
    expect(go("www.hivation.tech", "/dashboard/leads/42")).toBe(`${APP}/dashboard/leads/42`);
    expect(go("www.hivation.tech", "/login")).toBe(`${APP}/login`);
    expect(go("www.hivation.tech", "/invitation", "?token=abc")).toBe(`${APP}/invitation?token=abc`);
    expect(go("www.hivation.tech", "/reset-password", "?token=abc")).toBe(`${APP}/reset-password?token=abc`);
  });
  it("vitrine : garde l'accueil et la documentation", () => {
    expect(go("www.hivation.tech", "/")).toBeNull();
    expect(go("www.hivation.tech", "/docs/import")).toBeNull();
  });
  it("application : la racine ouvre le dashboard, la vitrine et la doc repartent sur hivation.tech", () => {
    expect(go("app.hivation.tech", "/")).toBe(`${APP}/dashboard`);
    expect(go("app.hivation.tech", "/docs/import")).toBe(`${SITE}/docs/import`);
    expect(go("app.hivation.tech", "/dashboard")).toBeNull();
    expect(go("app.hivation.tech", "/login")).toBeNull();
  });
  it("n'attrape pas un chemin qui ne fait que commencer pareil", () => {
    expect(go("www.hivation.tech", "/dashboards")).toBeNull();
  });
  it("avec un domaine de documentation : la doc y vit, le reste en repart", () => {
    const DOCS = "https://docs.hivation.tech";
    const to = (host: string, path: string) => hostRedirect(host, path, "", SITE, APP, DOCS);
    expect(to("www.hivation.tech", "/docs/import")).toBe(`${DOCS}/docs/import`);
    expect(to("app.hivation.tech", "/docs/import")).toBe(`${DOCS}/docs/import`);
    expect(to("docs.hivation.tech", "/")).toBe(`${DOCS}/docs`);
    expect(to("docs.hivation.tech", "/docs/import")).toBeNull();
    expect(to("docs.hivation.tech", "/login")).toBe(`${APP}/login`);
    expect(to("docs.hivation.tech", "/autre")).toBe(`${SITE}/autre`);
    expect(to("www.hivation.tech", "/")).toBeNull();
  });
  it("avec un domaine de CMS : /cms y vit, le reste en repart", () => {
    const CMS = "https://cms.hivation.tech";
    const to = (host: string, path: string) => hostRedirect(host, path, "", SITE, APP, undefined, CMS);
    expect(to("app.hivation.tech", "/cms")).toBe(`${CMS}/cms`);
    expect(to("cms.hivation.tech", "/")).toBe(`${CMS}/cms`);
    expect(to("cms.hivation.tech", "/cms")).toBeNull();
    expect(to("cms.hivation.tech", "/login")).toBe(`${APP}/login`);
  });
  it("autre domaine (prévisualisation, localhost) : jamais de redirection", () => {
    expect(go("hivation-git-x.vercel.app", "/dashboard")).toBeNull();
  });
});
