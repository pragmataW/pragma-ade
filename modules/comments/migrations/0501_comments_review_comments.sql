CREATE TABLE comments_review_comments (
  id TEXT PRIMARY KEY,
  worktree_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('editor','diff','browser')),
  file_path TEXT,
  line_start INTEGER,
  line_end INTEGER,
  diff_side TEXT CHECK (diff_side IN ('old','new')),
  snippet TEXT,
  language TEXT,
  element_json TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  target_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX comments_review_comments_wt_status ON comments_review_comments (worktree_id, status, created_at);
