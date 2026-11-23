import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { DOCS } from "@/lib/docs";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs");

export default function Page() {
  return (
    <DocArticle href="/docs">
      <h2>Par où commencer</h2>
      <p>
        Harvest vous aide à repérer, visiter et suivre vos leads sur le terrain. Cette documentation explique comment
        faire entrer vos leads existants dans Harvest, comment en sortir vos données, et comment chaque lead est placé
        sur la carte.
      </p>
      <ol>
        <li>
          <Link href="/docs/import">Importer des leads</Link> depuis un tableur ou un autre outil : un fichier CSV ou
          JSON suffit.
        </li>
        <li>
          Présentez votre fichier selon le <Link href="/docs/import/csv">format CSV</Link> ou le{" "}
          <Link href="/docs/import/json">format JSON</Link>.
        </li>
        <li>
          Vérifiez les <Link href="/docs/import/champs">champs acceptés</Link> et, si l’analyse signale des problèmes,
          consultez les <Link href="/docs/import/erreurs">messages d’erreur</Link>.
        </li>
      </ol>
      <Callout title="Un seul champ est obligatoire">
        Le nom de l’entreprise. Tout le reste est facultatif : vous pouvez importer une simple liste de noms et
        compléter les fiches ensuite.
      </Callout>

      <h2>Les guides</h2>
      <ul>
        {DOCS.filter((p) => p.href !== "/docs").map((p) => (
          <li key={p.href}>
            <Link href={p.href}>{p.title}</Link> — {p.description}
            {p.children && (
              <ul>
                {p.children.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href}>{c.title}</Link> — {c.description}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </DocArticle>
  );
}
