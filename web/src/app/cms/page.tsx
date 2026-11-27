import { CmsApp } from "@/components/cms/cms-app";
import { pageMetadata } from "@/lib/seo";

// Application privée : jamais indexée.
export const metadata = pageMetadata({ title: "Sites", description: "Composez les sites de vos clients, bloc par bloc.", path: "/cms", index: false });
export const instant = false;

export default function Page() {
  return <CmsApp />;
}
