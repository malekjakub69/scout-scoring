-- Adds organizer admins and per-race access control.

DEFINE FIELD IF NOT EXISTS is_admin ON organizer TYPE bool DEFAULT false;

-- Existing installations need at least one admin to manage users. This keeps
-- the migration non-locking for the current invite-only app.
UPDATE organizer SET is_admin = true WHERE is_admin = NONE;

DEFINE TABLE IF NOT EXISTS race_member SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS race ON race_member TYPE record<race>;
DEFINE FIELD IF NOT EXISTS organizer ON race_member TYPE record<organizer>;
DEFINE FIELD IF NOT EXISTS role ON race_member TYPE string ASSERT $value IN ["read", "edit"];
DEFINE FIELD IF NOT EXISTS created_at ON race_member TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON race_member TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS race_member_unique ON race_member FIELDS race, organizer UNIQUE;
DEFINE INDEX IF NOT EXISTS race_member_race ON race_member FIELDS race;
DEFINE INDEX IF NOT EXISTS race_member_organizer ON race_member FIELDS organizer;
