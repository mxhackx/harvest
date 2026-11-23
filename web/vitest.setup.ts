// Fuseau fixe (UTC+1, sans heure d'été) : les tests de calendrier ne dépendent pas de la machine.
process.env.TZ = "Africa/Porto-Novo";
// Avec une barre oblique finale, pour vérifier que l'URL du site est normalisée.
process.env.NEXT_PUBLIC_SITE_URL = "https://harvest.example/";
