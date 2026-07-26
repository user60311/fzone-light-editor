CREATE TABLE IF NOT EXISTS community_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  model_label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  profile_id INTEGER NOT NULL,
  point_count INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  payload TEXT NOT NULL,
  checksum TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_profiles_created_at
  ON community_profiles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_profiles_model_label
  ON community_profiles(model_label);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_profiles_payload
  ON community_profiles(payload);
