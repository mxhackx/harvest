-- 1. Un contact principal pour chaque lead qui avait déjà un nom de contact.
INSERT INTO "contacts" ("company_id", "lead_id", "name", "is_primary")
SELECT l."company_id", l."id", l."contact_name", true
FROM "leads" l
WHERE btrim(l."contact_name") <> ''
  AND NOT EXISTS (SELECT 1 FROM "contacts" c WHERE c."lead_id" = l."id");
--> statement-breakpoint
-- 2. Le fil d'activité des leads existants commence par leur création, à la date où ils ont été créés.
INSERT INTO "activities" ("company_id", "lead_id", "author_id", "kind", "meta", "occurred_at")
SELECT l."company_id", l."id", l."owner_id", 'created', '{"source":"existant"}'::jsonb, l."created_at" AT TIME ZONE 'UTC'
FROM "leads" l
WHERE NOT EXISTS (SELECT 1 FROM "activities" a WHERE a."lead_id" = l."id");
--> statement-breakpoint
-- 3. Sécurité par ligne, comme pour toutes les tables (un test le vérifie).
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
