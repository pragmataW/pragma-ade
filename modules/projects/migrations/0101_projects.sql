CREATE TABLE projects_projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, repo_path TEXT NOT NULL UNIQUE,
  default_base_branch TEXT NOT NULL, created_at INTEGER NOT NULL, sort_order INTEGER NOT NULL, archived_at INTEGER
);
CREATE TABLE projects_worktrees (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects_projects(id), path TEXT NOT NULL,
  branch TEXT, base_branch TEXT NOT NULL, is_main INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, archived_at INTEGER
);
CREATE UNIQUE INDEX projects_worktrees_live_path ON projects_worktrees(project_id, path) WHERE archived_at IS NULL;
CREATE INDEX projects_worktrees_project ON projects_worktrees(project_id);
CREATE TABLE projects_state (key TEXT PRIMARY KEY, value TEXT);
