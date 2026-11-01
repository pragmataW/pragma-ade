CREATE TABLE agents_sessions (
  id TEXT PRIMARY KEY,
  worktree_id TEXT NOT NULL,
  profile_id TEXT,
  provider_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'terminal',
  pty_id TEXT,
  title TEXT,
  ordinal INTEGER NOT NULL,
  status TEXT NOT NULL,
  external_session_id TEXT,
  exit_code INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  closed_at INTEGER,
  last_focused_at INTEGER
);
CREATE INDEX agents_sessions_worktree ON agents_sessions(worktree_id, closed_at);
