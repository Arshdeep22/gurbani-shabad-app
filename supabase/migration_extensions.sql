-- ============================================================
-- Migration: reading_progress extension / skip tracking
-- Run this in Supabase SQL Editor after previous migrations.
-- ============================================================

-- Add columns to reading_progress to track:
--   * whether the user has already used their one 5-hour extension
--   * timestamp when the shabad was skipped (deadline lapsed even after extension)
alter table public.reading_progress
  add column if not exists extension_used boolean not null default false,
  add column if not exists extended_until timestamptz,
  add column if not exists skipped boolean not null default false,
  add column if not exists skipped_at timestamptz;