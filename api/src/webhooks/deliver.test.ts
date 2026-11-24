import { describe, expect, it } from "vitest";
import { checkUrl, isPrivateIp, sign } from "./deliver.js";

describe("sign", () => {
  it("signe le corps avec le secret (HMAC SHA-256, préfixe sha256=)", () => {
    expect(sign("secret", "{}")).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(sign("secret", "{}")).not.toBe(sign("autre", "{}"));
    expect(sign("secret", "{}")).not.toBe(sign("secret", "{ }"));
  });
});

describe("isPrivateIp", () => {
  it("reconnaît les adresses internes, locales et réservées", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd12::1", "::ffff:10.0.0.1", "fe80::1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("checkUrl", () => {
  it("n'accepte que https, sans identifiants (en test, http est toléré pour le serveur local)", async () => {
    expect(await checkUrl("pas une adresse")).toBe("adresse invalide");
    expect(await checkUrl("ftp://exemple.fr/x")).toContain("https://");
    expect(await checkUrl("https://user:pw@exemple.fr/x")).toContain("identifiants");
    expect(await checkUrl("https://exemple.fr/hook")).toBeNull();
  });
});
