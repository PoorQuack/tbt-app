-- 0001_init.sql: TBT Web App Schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS operatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'Three Eagles Ltd',
    role TEXT DEFAULT 'Operative',
    trade TEXT,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tbts (
    id TEXT PRIMARY KEY,
    doc_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    doc_owner TEXT NOT NULL DEFAULT 'Operations Director',
    last_revision TEXT NOT NULL,
    next_revision TEXT NOT NULL,
    category TEXT DEFAULT 'Health & Safety',
    prepare_text TEXT,
    reason_text TEXT,
    why_text TEXT,
    outline_text TEXT,
    content_json TEXT NOT NULL,
    comprehension_question TEXT NOT NULL,
    comprehension_options_json TEXT NOT NULL,
    correct_option_index INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tbt_id TEXT NOT NULL,
    doc_code TEXT NOT NULL,
    tbt_title TEXT NOT NULL,
    doc_owner TEXT NOT NULL,
    last_revision TEXT NOT NULL,
    next_revision TEXT NOT NULL,
    operative_id INTEGER NOT NULL,
    operative_name TEXT NOT NULL,
    operative_company TEXT NOT NULL,
    scrolled_to_bottom INTEGER NOT NULL DEFAULT 1,
    comprehension_passed INTEGER NOT NULL DEFAULT 1,
    selected_answer TEXT,
    notes TEXT,
    signature_png TEXT NOT NULL,
    user_agent TEXT,
    client_ip TEXT,
    signed_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tbt_id) REFERENCES tbts(id),
    FOREIGN KEY (operative_id) REFERENCES operatives(id)
);

CREATE INDEX IF NOT EXISTS idx_signoffs_tbt_code ON signoffs(doc_code);
CREATE INDEX IF NOT EXISTS idx_signoffs_operative_id ON signoffs(operative_id);
CREATE INDEX IF NOT EXISTS idx_signoffs_signed_at ON signoffs(signed_at);
CREATE INDEX IF NOT EXISTS idx_operatives_active ON operatives(active);
CREATE INDEX IF NOT EXISTS idx_tbts_active ON tbts(active);
