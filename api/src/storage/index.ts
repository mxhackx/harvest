import { StorageClient } from "@supabase/storage-js";
import { config } from "../config.js";

/** Le stockage de fichiers vu par l'application : un bucket PRIVÉ, jamais d'adresse publique. */
export type Storage = {
  /** Adresse signée à laquelle le navigateur envoie le fichier. */
  signUpload(path: string): Promise<string>;
  /** Adresse de téléchargement valable une minute. */
  signDownload(path: string, downloadName: string): Promise<string>;
  /** Taille et premiers octets de l'objet déposé, null s'il n'existe pas. */
  head(path: string): Promise<{ size: number; start: Uint8Array } | null>;
  remove(paths: string[]): Promise<void>;
};

function supabase(url: string, key: string, bucket: string): Storage {
  const files = () => new StorageClient(`${url.replace(/\/$/, "")}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` }).from(bucket);
  const signed = async (path: string, seconds: number, download?: string) => {
    const { data, error } = await files().createSignedUrl(path, seconds, download ? { download } : undefined);
    return error ? null : data.signedUrl;
  };
  return {
    async signUpload(path) {
      const { data, error } = await files().createSignedUploadUrl(path);
      if (error) throw error;
      return data.signedUrl;
    },
    async signDownload(path, name) {
      const link = await signed(path, 60, name);
      if (!link) throw new Error("fichier introuvable dans le stockage");
      return link;
    },
    async head(path) {
      const link = await signed(path, 60);
      if (!link) return null;
      const res = await fetch(link, { headers: { range: "bytes=0-15" } });
      if (!res.ok) return null;
      const start = new Uint8Array(await res.arrayBuffer()).slice(0, 16);
      const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length"));
      return { size: total, start };
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await files().remove(paths);
      if (error) throw error;
    },
  };
}

let override: Storage | null | undefined;
/** Pour les tests : remplace le stockage (undefined = revenir à la configuration). */
export const setStorage = (s: Storage | null | undefined) => {
  override = s;
};
/** null tant que SUPABASE_URL et SUPABASE_SECRET_KEY ne sont pas renseignées. */
export const getStorage = (): Storage | null => {
  if (override !== undefined) return override;
  const { url, key, bucket } = config.storage;
  return url && key ? supabase(url, key, bucket) : null;
};
