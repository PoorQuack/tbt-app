-- Migration 0005: Add access_pin column to companies table for company-based authentication
ALTER TABLE companies ADD COLUMN access_pin TEXT NOT NULL DEFAULT '2026';
