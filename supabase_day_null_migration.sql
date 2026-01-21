-- ============================================
-- Supabase Migration: Allow NULL day for RVNC Jan 24th Event
-- ============================================
-- Run these commands in Supabase SQL Editor
-- ============================================

-- Step 1: Drop the existing day check constraint
-- This constraint likely only allows 'saturday' or 'sunday'
ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_day_check;

-- Step 2: Alter the day column to allow NULL values
-- This removes the NOT NULL constraint
ALTER TABLE players
ALTER COLUMN day DROP NOT NULL;

-- Step 3: Add a new constraint that allows NULL (for RVNC Jan 24th) or valid day values
ALTER TABLE players
ADD CONSTRAINT players_day_check 
CHECK (day IS NULL OR day IN ('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

-- Step 4: Do the same for pending_winners table if it exists
ALTER TABLE pending_winners
DROP CONSTRAINT IF EXISTS pending_winners_day_check;

ALTER TABLE pending_winners
ALTER COLUMN day DROP NOT NULL;

ALTER TABLE pending_winners
ADD CONSTRAINT pending_winners_day_check 
CHECK (day IS NULL OR day IN ('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

-- ============================================
-- Verification Queries (Optional - run to verify)
-- ============================================

-- Check constraint details
-- SELECT conname, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint
-- WHERE conname = 'players_day_check';

-- Count players by day (including NULL)
-- SELECT day, COUNT(*) as count
-- FROM players
-- GROUP BY day
-- ORDER BY day NULLS LAST;
