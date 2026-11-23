"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS, type DocPage } from "@/lib/docs";

function Item({ page, path, depth }: { page: DocPage; path: string; depth: number }) {
  const active = page.href === path;
  const open = path === page.href || path.startsWith(page.href + "/");
  return (
    <li>
      <Link
        href={page.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-9 items-center rounded-control border px-2 text-body ${depth ? "ml-3" : ""} ${
          active ? "border-accent/25 bg-accent-soft font-medium" : "border-transparent hover:bg-field"
        }`}
      >
        {page.title}
      </Link>
      {page.children && open && (
        <ul className="mt-1 flex flex-col gap-1">
          {page.children.map((c) => (
            <Item key={c.href} page={c} path={path} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DocNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sommaire de la documentation">
      <ul className="flex flex-col gap-1">
        {DOCS.map((p) => (
          <Item key={p.href} page={p} path={path} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
