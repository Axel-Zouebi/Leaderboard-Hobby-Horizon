-- ============================================
-- Supabase Migration: Add event Support
-- ============================================
-- Run these commands in Supabase SQL Editor
-- ============================================

-- Step 1: Add event column to players table
-- This column will be nullable to support backward compatibility
ALTER TABLE players
ADD COLUMN IF NOT EXISTS event TEXT;

-- Step 2: Set default value for existing players (they belong to hobby-horizon)
-- All existing players without event should be marked as hobby-horizon
UPDATE players
SET event = 'hobby-horizon'
WHERE event IS NULL;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_players_event 
ON players(event) 
WHERE event IS NOT NULL;

-- ============================================
-- Verification Queries (Optional - run to verify)
-- ============================================

-- Check players table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'players' AND column_name = 'event';

-- Count players by event
-- SELECT event, COUNT(*) as count
-- FROM players
-- GROUP BY event
-- ORDER BY event;
