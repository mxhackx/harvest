-- Les rôles système sont copiés par entreprise : on ajoute les droits « event:* » aux rôles déjà existants.
-- CEO et Manager voient tout ; Prospecteur et Taffeur gèrent leurs propres rendez-vous.
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", p.permission, p.scope::"scope"
FROM "roles" r
JOIN (VALUES
  ('ceo', 'event:read', 'company'), ('ceo', 'event:create', 'company'), ('ceo', 'event:update', 'company'), ('ceo', 'event:delete', 'company'),
  ('manager', 'event:read', 'company'), ('manager', 'event:create', 'company'), ('manager', 'event:update', 'company'), ('manager', 'event:delete', 'company'),
  ('prospecteur', 'event:read', 'own'), ('prospecteur', 'event:create', 'own'), ('prospecteur', 'event:update', 'own'), ('prospecteur', 'event:delete', 'own'),
  ('worker', 'event:read', 'own'), ('worker', 'event:create', 'own'), ('worker', 'event:update', 'own'), ('worker', 'event:delete', 'own')
) AS p(role_key, permission, scope) ON p.role_key = r."key"
WHERE r."is_system" = true
ON CONFLICT ("role_id", "permission") DO NOTHING;
