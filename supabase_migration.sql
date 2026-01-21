-- ============================================
-- Supabase Migration: Add tournament_type Support
-- ============================================
-- Run these commands in Supabase SQL Editor
-- ============================================

-- Step 1: Add tournament_type column to players table
-- This column will be nullable to support backward compatibility
ALTER TABLE players
ADD COLUMN IF NOT EXISTS tournament_type TEXT;

-- Step 2: Add CHECK constraint to ensure only valid values
-- This ensures tournament_type can only be 'all-day' or 'special' (or NULL)
ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_tournament_type_check;

ALTER TABLE players
ADD CONSTRAINT players_tournament_type_check 
CHECK (tournament_type IS NULL OR tournament_type IN ('all-day', 'special'));

-- Step 3: Set default value for existing Sunday players
-- All existing Sunday players should default to 'all-day'
UPDATE players
SET tournament_type = 'all-day'
WHERE day = 'sunday' AND tournament_type IS NULL;

-- Step 4: Add tournament_type column to pending_winners table
ALTER TABLE pending_winners
ADD COLUMN IF NOT EXISTS tournament_type TEXT;

-- Step 5: Add CHECK constraint for pending_winners table
ALTER TABLE pending_winners
DROP CONSTRAINT IF EXISTS pending_winners_tournament_type_check;

ALTER TABLE pending_winners
ADD CONSTRAINT pending_winners_tournament_type_check 
CHECK (tournament_type IS NULL OR tournament_type IN ('all-day', 'special'));

-- Step 6: Set default value for existing Sunday pending winners
UPDATE pending_winners
SET tournament_type = 'all-day'
WHERE day = 'sunday' AND tournament_type IS NULL;

-- Step 7: Create index for better query performance
-- This will help with filtering by tournament_type
CREATE INDEX IF NOT EXISTS idx_players_tournament_type 
ON players(day, tournament_type) 
WHERE tournament_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_winners_tournament_type 
ON pending_winners(day, tournament_type) 
WHERE tournament_type IS NOT NULL;

-- ============================================
-- Verification Queries (Optional - run to verify)
-- ============================================

-- Check players table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'players' AND column_name = 'tournament_type';

-- Check pending_winners table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'pending_winners' AND column_name = 'tournament_type';

-- Count players by tournament type
-- SELECT day, tournament_type, COUNT(*) as count
-- FROM players
-- GROUP BY day, tournament_type
-- ORDER BY day, tournament_type;

-- Count pending winners by tournament type
-- SELECT day, tournament_type, COUNT(*) as count
-- FROM pending_winners
-- GROUP BY day, tournament_type
-- ORDER BY day, tournament_type;

