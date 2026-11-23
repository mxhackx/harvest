-- Les rôles système sont copiés par entreprise à sa création : la nouvelle permission lead:export
-- doit être ajoutée aux CEO et Manager déjà existants (les autres rôles ne l'ont pas par défaut).
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", 'lead:export', 'company'
FROM "roles" r
WHERE r."is_system" = true AND r."key" IN ('ceo', 'manager')
ON CONFLICT ("role_id", "permission") DO NOTHING;
