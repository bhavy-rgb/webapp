-- Online friend games: stores game rooms and their move lists.
-- Move legality is validated by the same FIDE engine on each client;
-- the server enforces turn order, player identity and game codes.
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,              -- 6-char shareable game code
  white_token TEXT,                       -- secret token of the white player
  black_token TEXT,                       -- secret token of the black player
  creator_color TEXT NOT NULL DEFAULT 'w',-- color the creator chose
  moves TEXT NOT NULL DEFAULT '[]',       -- JSON array of {from,to,promotion}
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | active | finished
  result TEXT,                            -- e.g. 'checkmate:w', 'resign:b', 'draw:agreement'
  time_minutes INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
  increment_seconds INTEGER NOT NULL DEFAULT 0,
  white_ms INTEGER,                       -- remaining clock ms
  black_ms INTEGER,
  last_move_at INTEGER,                   -- epoch ms of last move (for clock calc)
  draw_offer TEXT,                        -- 'w' | 'b' | NULL: pending draw offer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
