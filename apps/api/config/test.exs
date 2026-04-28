import Config

# Skip SurrealDB migrations at startup during tests — tests run against
# a pre-migrated DB (or don't touch the DB at all).
config :api,
  run_migrations_on_start: false,
  run_seed_on_start: false

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :api, ApiWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "2x9+fiPfGsk19wQFPABh4Z5PSfE/5QfH5UxPATbMgeNuVSCS3efIenj6YlkjwDlX",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
