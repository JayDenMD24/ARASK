-- ARASK · esquema inicial (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_key    TEXT,
  verified      INTEGER NOT NULL DEFAULT 0,      -- rescatista verificado por un admin
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE cases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT, -- también es el número de caso
  name          TEXT NOT NULL,
  species       TEXT NOT NULL CHECK (species IN ('perro', 'gato', 'otro')),
  sex           TEXT CHECK (sex IN ('Hembra', 'Macho')),
  profile       TEXT,
  condition     TEXT NOT NULL CHECK (condition IN ('saludable', 'herido', 'desnutrido', 'urgente')),
  status        TEXT NOT NULL DEFAULT 'reportado'
                CHECK (status IN ('reportado', 'en_atencion', 'rescatado', 'adopcion', 'cerrado')),
  description   TEXT NOT NULL DEFAULT '',
  medical_note  TEXT,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  address       TEXT NOT NULL,
  zone          TEXT NOT NULL,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  anonymous     INTEGER NOT NULL DEFAULT 0,
  verified      INTEGER NOT NULL DEFAULT 0,
  hidden        INTEGER NOT NULL DEFAULT 0,       -- ocultado por moderación
  hidden_reason TEXT,
  donation_goal INTEGER NOT NULL DEFAULT 200000,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_cases_created ON cases(created_at);
CREATE INDEX idx_cases_reporter ON cases(reporter_id);
CREATE INDEX idx_cases_geo ON cases(lat, lng);

CREATE TABLE case_photos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id  INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_photos_case ON case_photos(case_id);

CREATE TABLE case_needs (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  need    TEXT NOT NULL CHECK (need IN ('alimento', 'veterinario', 'traslado', 'hogar', 'medicamentos', 'donacion')),
  detail  TEXT,
  state   TEXT NOT NULL DEFAULT 'pendiente' CHECK (state IN ('pendiente', 'en_camino', 'cubierto')),
  PRIMARY KEY (case_id, need)
);

CREATE TABLE case_events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status  TEXT NOT NULL,
  detail  TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_events_case ON case_events(case_id);

CREATE TABLE case_helpers (
  case_id   INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  help_type TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (case_id, user_id)
);
CREATE INDEX idx_helpers_user ON case_helpers(user_id);

CREATE TABLE case_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_comments_case ON case_comments(case_id);

CREATE TABLE case_flags (
  case_id    INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('falso', 'duplicado', 'inapropiado', 'resuelto')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (case_id, user_id)
);

CREATE TABLE saved_cases (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id  INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, case_id)
);

CREATE TABLE campaigns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  goal       INTEGER NOT NULL,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE donations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  case_id     INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  campaign_id INTEGER REFERENCES campaigns(id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  frequency   TEXT NOT NULL CHECK (frequency IN ('unica', 'mensual')),
  destination TEXT NOT NULL,
  method      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'simulada',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_donations_user ON donations(user_id);
CREATE INDEX idx_donations_case ON donations(case_id);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  case_id    INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- Campaña inicial (configuración, no datos de prueba). El admin puede editarla.
INSERT INTO campaigns (title, goal, starts_at, ends_at, active)
VALUES ('Fondo de Rescates y Salud Callejera', 5000000, '2026-11-01T05:00:00Z', '2026-12-01T04:59:59Z', 1);
