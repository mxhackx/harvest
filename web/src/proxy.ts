import { NextResponse, type NextRequest } from "next/server";
import { hostRedirect } from "@/lib/hosts";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = hostRedirect(
    request.headers.get("host") ?? "",
    pathname,
    search,
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_DOCS_URL,
    process.env.NEXT_PUBLIC_CMS_URL,
  );
  return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}

// Ni l'API relayée, ni les fichiers statiques, ni les images générées (partage, icônes).
export const config = { matcher: ["/((?!api|_next|opengraph-image|twitter-image|icon|apple-icon|.*\\..*).*)"] };
