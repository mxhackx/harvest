-- 1. Étapes par défaut pour chaque entreprise existante. Les clés correspondent aux anciennes valeurs de
--    leads.status : les leads gardent donc leur étape sans autre conversion.
INSERT INTO "pipeline_stages" ("company_id", "key", "name", "color", "probability", "kind", "position")
SELECT c."id", d.key, d.name, d.color, d.probability, d.kind::"stage_kind", d.position
FROM "companies" c
CROSS JOIN (VALUES
  ('to_visit',     'À visiter',        '#e5484d',                  10,  'open', 0),
  ('interested',   'Intéressé',        '#0868c9',                  30,  'open', 1),
  ('mockup_sent',  'Maquette envoyée', 'rgba(34, 170, 94, 0.6)',   60,  'open', 2),
  ('deposit_paid', 'Acompte payé',     '#12c457',                  90,  'open', 3),
  ('won',          'Gagné',            '#07625a',                  100, 'won',  4),
  ('lost',         'Perdu',            '#8a99a6',                  0,   'lost', 5)
) AS d(key, name, color, probability, kind, position)
ON CONFLICT ("company_id", "key") DO NOTHING;
--> statement-breakpoint
-- 2. Les droits de gérer le pipeline vont aux CEO et Manager existants.
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", p.permission, 'company'::"scope"
FROM "roles" r
CROSS JOIN (VALUES ('stage:create'), ('stage:update'), ('stage:delete')) AS p(permission)
WHERE r."is_system" = true AND r."key" IN ('ceo', 'manager')
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
-- 3. Sécurité par ligne, comme pour toutes les tables (un test le vérifie).
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
