CREATE TABLE agents_profiles (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT,
  command TEXT,
  args TEXT,
  env_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX agents_profiles_one_default ON agents_profiles(is_default) WHERE is_default = 1;
CREATE UNIQUE INDEX agents_profiles_one_builtin ON agents_profiles(provider_id) WHERE is_builtin = 1;
