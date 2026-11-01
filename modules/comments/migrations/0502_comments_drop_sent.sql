-- Delivered comments are no longer kept (2026-11-02): drop the old sent rows and the sent-only columns.
DELETE FROM comments_review_comments WHERE status = 'sent';
DROP INDEX comments_review_comments_wt_status;
ALTER TABLE comments_review_comments DROP COLUMN status;
ALTER TABLE comments_review_comments DROP COLUMN target_session_id;
ALTER TABLE comments_review_comments DROP COLUMN sent_at;
CREATE INDEX comments_review_comments_wt_created ON comments_review_comments (worktree_id, created_at);
