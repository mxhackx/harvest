import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { FIELD_DOCS, IGNORED_EXPORT_COLUMNS } from "@/lib/lead-fields";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/import/champs");

export default function Page() {
  return (
    <DocArticle href="/docs/import/champs">
      <p>
        Le nom de colonne (CSV) ou de clé (JSON) à utiliser est la première colonne du tableau. Les noms alternatifs,
        français ou abrégés, sont acceptés à la place : la casse, les accents, les espaces et les tirets sont ignorés.
      </p>

      <h2>Vue d’ensemble</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Champ</th>
              <th>Obligatoire</th>
              <th>Type</th>
              <th>Exemple</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_DOCS.map((f) => (
              <tr key={f.key}>
                <td>
                  <a href={`#${f.key}`}>
                    <code>{f.key}</code>
                  </a>
                </td>
                <td>{f.required ? "oui" : "non"}</td>
                <td>{f.type}</td>
                <td>
                  <code>{f.example}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Détail de chaque champ</h2>
      {FIELD_DOCS.map((f) => (
        <section key={f.key} id={f.key} className="scroll-mt-20">
          <h3>
            {f.label} <code>{f.key}</code>
            {f.required && <span className="ml-2 text-small text-muted">obligatoire</span>}
          </h3>
          <p>{f.description}</p>
          <ul>
            <li>
              Type : {f.type}
            </li>
            {f.accepted && <li>Valeurs acceptées : {f.accepted}</li>}
            <li>
              Noms alternatifs : {f.aliases.map((a, i) => (
                <span key={a}>
                  {i > 0 && ", "}
                  <code>{a}</code>
                </span>
              ))}
            </li>
            <li>
              Exemple : <code>{f.example}</code>
            </li>
          </ul>
        </section>
      ))}

      <h2>Colonnes d’un export {BRAND.name}</h2>
      <p>
        Ces colonnes sont reconnues dans un fichier issu de <Link href="/docs/export">l’export</Link> mais ne sont pas
        importées, car {BRAND.name} les calcule lui-même :{" "}
        {IGNORED_EXPORT_COLUMNS.map((c, i) => (
          <span key={c}>
            {i > 0 && ", "}
            <code>{c}</code>
          </span>
        ))}
        . Elles n’apparaissent donc pas dans la liste des colonnes non reconnues.
      </p>

      <Callout title="Coordonnées et position">
        <code>lat</code> et <code>lng</code> vont toujours ensemble : l’une sans l’autre est une erreur. Si elles sont
        absentes, {BRAND.name} cherche la position à partir du lien Google Maps ou de l’adresse. Voir{" "}
        <Link href="/docs/localisation">Position sur la carte</Link>.
      </Callout>
    </DocArticle>
  );
}
