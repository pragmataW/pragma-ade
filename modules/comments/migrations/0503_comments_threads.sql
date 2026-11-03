-- Review threads (2026-11-03): comments are kept after delivery, get a status and ordered replies; rounds per worktree.
ALTER TABLE comments_review_comments ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved'));
ALTER TABLE comments_review_comments ADD COLUMN round INTEGER;
ALTER TABLE comments_review_comments ADD COLUMN resolved_at INTEGER;
CREATE INDEX comments_review_comments_wt_status ON comments_review_comments (worktree_id, status, created_at);
CREATE TABLE comments_review_replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments_review_comments(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('user','agent')),
  body TEXT NOT NULL,
  session_id TEXT,
  author_label TEXT,
  round INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_review_replies_comment ON comments_review_replies (comment_id, created_at);
CREATE TABLE comments_review_rounds (
  worktree_id TEXT PRIMARY KEY,
  last_round INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
