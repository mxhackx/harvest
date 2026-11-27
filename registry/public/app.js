/* Recherche, filtre par catégorie, copie du JSON. En local, « Ajouter » vise le CMS de développement. */
const cards = [...document.querySelectorAll("article")];
let category = "";
const apply = () => {
  const q = document.getElementById("search").value.trim().toLowerCase();
  for (const c of cards) c.hidden = !((!category || c.dataset.category === category) && (!q || c.dataset.search.includes(q)));
};
document.getElementById("search").addEventListener("input", apply);
for (const b of document.querySelectorAll("[data-filter]"))
  b.addEventListener("click", () => {
    category = b.dataset.filter;
    for (const other of document.querySelectorAll("[data-filter]")) other.setAttribute("aria-pressed", String(other === b));
    apply();
  });
for (const b of document.querySelectorAll("[data-copy]"))
  b.addEventListener("click", async () => {
    const json = await (await fetch(`r/${b.dataset.copy}.json`)).text();
    await navigator.clipboard.writeText(json);
    b.textContent = "Copié";
    setTimeout(() => (b.textContent = "Copier le JSON"), 1500);
  });
if (location.hostname === "localhost") for (const a of document.querySelectorAll("[data-add]")) a.href = `http://localhost:3000/cms?add=${a.dataset.add}`;
