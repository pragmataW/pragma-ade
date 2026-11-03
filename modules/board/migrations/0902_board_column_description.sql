-- Optional per-column guidance (plain text) for people and agents working the board.
ALTER TABLE board_columns ADD COLUMN description TEXT NOT NULL DEFAULT '';
