import { ROUTES } from "@/lib/routes";
import { TasksPage } from "@/components/tasks-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Tâches",
  description: "Vos tâches et rappels, classés par urgence.",
  path: ROUTES.tasks,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TasksPage />;
}
