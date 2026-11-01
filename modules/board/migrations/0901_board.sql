CREATE TABLE board_boards (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT UNIQUE, name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, next_number INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE board_columns (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL REFERENCES board_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sort_order TEXT NOT NULL);
CREATE UNIQUE INDEX board_columns_board_name ON board_columns(board_id, name COLLATE NOCASE);
CREATE TABLE board_labels (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL REFERENCES board_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT NOT NULL);
CREATE UNIQUE INDEX board_labels_board_name ON board_labels(board_id, name COLLATE NOCASE);
CREATE TABLE board_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL REFERENCES board_boards(id) ON DELETE CASCADE,
  number INTEGER NOT NULL, column_id INTEGER NOT NULL REFERENCES board_columns(id), title TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'none'
    CHECK (priority IN ('none','low','medium','high','urgent')),
  labels_json TEXT NOT NULL DEFAULT '[]', worktree_id TEXT, sort_order TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (board_id, number));
CREATE INDEX board_tasks_column_sort ON board_tasks(column_id, sort_order);
CREATE INDEX board_tasks_worktree ON board_tasks(worktree_id);
CREATE TABLE board_task_sessions (task_id INTEGER NOT NULL REFERENCES board_tasks(id) ON DELETE CASCADE,
  agent_session_id TEXT NOT NULL, linked_at INTEGER NOT NULL, PRIMARY KEY (task_id, agent_session_id));
CREATE INDEX board_task_sessions_session ON board_task_sessions(agent_session_id);
