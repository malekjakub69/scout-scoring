-- Add station access fields and half-point scoring support for databases
-- created before these fields were added to the initial schema.
DEFINE FIELD IF NOT EXISTS allow_half_points ON station TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS access_token_hash ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS pin ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS token_nonce ON station TYPE option<string>;
DEFINE FIELD IF NOT EXISTS is_active ON station TYPE bool DEFAULT false;

-- Existing station records may have allow_half_points = NONE from before the
-- field was introduced. The schema expects a bool, so any later station update
-- would fail validation until the value is backfilled.
UPDATE station SET allow_half_points = false WHERE allow_half_points = NONE;
