-- 0004_companies_and_accounts.sql: Companies directory and delegated company coordinator accounts

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_default INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 10,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Seed the 6 site companies for AGC South Site
INSERT OR IGNORE INTO companies (name, is_default, display_order, active) VALUES
    ('Three Eagles Ltd', 1, 1, 1),
    ('Avondale Construction Limited', 0, 2, 1),
    ('PME', 0, 3, 1),
    ('360', 0, 4, 1),
    ('Ruddy', 0, 5, 1),
    ('Aquascape', 0, 6, 1);

-- 3. Create company_accounts for delegated company reps
CREATE TABLE IF NOT EXISTS company_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    access_pin TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);
CREATE INDEX IF NOT EXISTS idx_company_accounts_pin ON company_accounts(access_pin);
CREATE INDEX IF NOT EXISTS idx_company_accounts_company ON company_accounts(company_name);
