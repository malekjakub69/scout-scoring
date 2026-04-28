-- Scout Scoring — initial SurrealDB 3.x schema
-- Idempotent: uses IF NOT EXISTS so it can be re-run safely.

-- =============================================================
-- organizers (full account holders)
-- =============================================================
DEFINE TABLE IF NOT EXISTS organizer SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS email ON organizer TYPE string ASSERT $value != NONE AND string::is_email($value);
DEFINE FIELD IF NOT EXISTS name ON organizer TYPE string;
DEFINE FIELD IF NOT EXISTS password_hash ON organizer TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON organizer TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS invited_by ON organizer TYPE option<record<organizer>>;
DEFINE INDEX IF NOT EXISTS organizer_email_unique ON organizer FIELDS email UNIQUE;

-- =============================================================
-- races
-- =============================================================
DEFINE TABLE IF NOT EXISTS race SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON race TYPE string;
DEFINE FIELD IF NOT EXISTS held_on ON race TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS location ON race TYPE option<string>;
DEFINE FIELD IF NOT EXISTS owner ON race TYPE record<organizer>;
DEFINE FIELD IF NOT EXISTS state ON race TYPE string
  ASSERT $value IN ["draft", "active", "closed"]
  DEFAULT "draft";
DEFINE FIELD IF NOT EXISTS scoring_model ON race TYPE string
  ASSERT $value IN ["sum_points"]
  DEFAULT "sum_points";
DEFINE FIELD IF NOT EXISTS time_tracking ON race TYPE string
  ASSERT $value IN ["none", "per_station", "start_finish"]
  DEFAULT "none";
DEFINE FIELD IF NOT EXISTS created_at ON race TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS activated_at ON race TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS closed_at ON race TYPE option<datetime>;
DEFINE INDEX IF NOT EXISTS race_owner ON race FIELDS owner;

-- =============================================================
-- categories (per race)
-- =============================================================
DEFINE TABLE IF NOT EXISTS category SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS race ON category TYPE record<race>;
DEFINE FIELD IF NOT EXISTS name ON category TYPE string;
DEFINE FIELD IF NOT EXISTS scored ON category TYPE bool DEFAULT true;
DEFINE INDEX IF NOT EXISTS category_race_name ON category FIELDS race, name UNIQUE;

-- Auto-create default categories for every newly created race.
DEFINE EVENT IF NOT EXISTS race_default_categories ON TABLE race
WHEN $event = "CREATE"
THEN {
  CREATE category SET race = $after.id, name = "holčičí", scored = true;
  CREATE category SET race = $after.id, name = "klučičí", scored = true;
  CREATE category SET race = $after.id, name = "nesoutěžní", scored = false;
};

-- =============================================================
-- patrols
-- =============================================================
DEFINE TABLE IF NOT EXISTS patrol SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS race ON patrol TYPE record<race>;
DEFINE FIELD IF NOT EXISTS category ON patrol TYPE record<category>;
DEFINE FIELD IF NOT EXISTS start_number ON patrol TYPE int ASSERT $value > 0;
DEFINE FIELD IF NOT EXISTS name ON patrol TYPE string;
DEFINE FIELD IF NOT EXISTS members ON patrol TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS created_at ON patrol TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS patrol_race_start ON patrol FIELDS race, start_number UNIQUE;
DEFINE INDEX IF NOT EXISTS patrol_race ON patrol FIELDS race;

-- =============================================================
-- stations (with dynamic criteria)
-- =============================================================
DEFINE TABLE IF NOT EXISTS station SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS race ON station TYPE record<race>;
DEFINE FIELD IF NOT EXISTS name ON station TYPE string;
DEFINE FIELD IF NOT EXISTS position ON station TYPE int DEFAULT 0;
-- criteria is an array of { name: string, max_points: number }
DEFINE FIELD IF NOT EXISTS criteria ON station TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS criteria.*.name ON station TYPE string;
DEFINE FIELD IF NOT EXISTS criteria.*.max_points ON station TYPE number ASSERT $value >= 0;
DEFINE FIELD IF NOT EXISTS access_token_hash ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS pin ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS token_nonce ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS is_active ON station TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS created_at ON station TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS station_race ON station FIELDS race;

-- =============================================================
-- score entries (one per station+patrol, overwrite-on-resubmit)
-- =============================================================
DEFINE TABLE IF NOT EXISTS score_entry SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS station ON score_entry TYPE record<station>;
DEFINE FIELD IF NOT EXISTS patrol ON score_entry TYPE record<patrol>;
DEFINE FIELD IF NOT EXISTS race ON score_entry TYPE record<race>;
-- scores: array of { criterion: string, points: number }
DEFINE FIELD IF NOT EXISTS scores ON score_entry TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS scores.*.criterion ON score_entry TYPE string;
DEFINE FIELD IF NOT EXISTS scores.*.points ON score_entry TYPE number ASSERT $value >= 0;
DEFINE FIELD IF NOT EXISTS arrived_at ON score_entry TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS departed_at ON score_entry TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS submitted_by ON score_entry TYPE string; -- "station:<id>" or "organizer:<id>"
DEFINE FIELD IF NOT EXISTS created_at ON score_entry TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON score_entry TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS score_station_patrol_unique ON score_entry FIELDS station, patrol UNIQUE;
DEFINE INDEX IF NOT EXISTS score_race ON score_entry FIELDS race;

-- =============================================================
-- audit log (all mutations: who / what / before / after)
-- =============================================================
DEFINE TABLE IF NOT EXISTS audit_log SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS at ON audit_log TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS actor ON audit_log TYPE string;      -- "organizer:<id>" | "station:<id>" | "system"
DEFINE FIELD IF NOT EXISTS action ON audit_log TYPE string;     -- e.g. "score.create"
DEFINE FIELD IF NOT EXISTS race ON audit_log TYPE option<record<race>>;
DEFINE FIELD IF NOT EXISTS entity ON audit_log TYPE option<string>; -- record id string
DEFINE FIELD OVERWRITE payload ON audit_log TYPE option<object> FLEXIBLE;
DEFINE INDEX IF NOT EXISTS audit_race ON audit_log FIELDS race;
DEFINE INDEX IF NOT EXISTS audit_at ON audit_log FIELDS at;
