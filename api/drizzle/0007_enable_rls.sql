-- Supabase expose les tables du schéma public via une API REST (rôles anon / authenticated).
-- RLS activée SANS règle : ces rôles n'ont accès à rien. L'API se connecte avec le rôle propriétaire,
-- qui contourne la RLS : son fonctionnement ne change pas.
-- Toute nouvelle table doit être ajoutée ici (un test le vérifie).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
