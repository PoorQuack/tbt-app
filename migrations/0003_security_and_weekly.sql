-- 0003_security_and_weekly.sql: Add operative PINs, briefing weeks, and unique weekly signoff index

-- 1. Add 4-digit PIN to operatives with default '1234'
ALTER TABLE operatives ADD COLUMN pin TEXT NOT NULL DEFAULT '1234';

-- 2. Add briefing_week to tbts (defaults to 'Week 1')
ALTER TABLE tbts ADD COLUMN briefing_week TEXT NOT NULL DEFAULT 'Week 1';

-- 3. Add briefing_week to signoffs (defaults to 'Week 1')
ALTER TABLE signoffs ADD COLUMN briefing_week TEXT NOT NULL DEFAULT 'Week 1';

-- 4. Create unique index to guarantee one sign-off per operative per TBT per briefing week
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_weekly_signoff ON signoffs(doc_code, operative_id, briefing_week);
