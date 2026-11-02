CREATE TABLE local_history_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worktree_id TEXT NOT NULL,
  cwd TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  head_sha TEXT,
  restored_at INTEGER
);
CREATE INDEX local_history_entries_created_at ON local_history_entries (created_at);
CREATE TABLE local_history_files (
  entry_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  state TEXT NOT NULL,
  blob TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, path)
);
CREATE TABLE local_history_stashes (
  entry_id INTEGER NOT NULL,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  PRIMARY KEY (entry_id, sha)
);
