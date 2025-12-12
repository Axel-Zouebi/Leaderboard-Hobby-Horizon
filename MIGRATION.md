# Database Migration Guide - Adding Points System

## Overview
This migration adds a `points` column to your Supabase database tables to support the new points-based ranking system.

## Automatic Migration (Local JSON Files)
If you're using local JSON files (`data.json` and `pending_data.json`), the migration happens automatically:
- When the app reads old data, it detects missing `points` fields
- It automatically adds `points: 0` to all existing players
- The migrated data is saved back to the files

**No action needed for local files!**

## Manual Migration (Supabase Database)

If you're using Supabase, you need to manually add the `points` column to your database tables.

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Run Migration SQL

Run the following SQL commands to add the `points` column to both tables:

```sql
-- Add points column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Update existing rows to have 0 points (if column was just added)
UPDATE players 
SET points = 0 
WHERE points IS NULL;

-- Add points column to pending_winners table
ALTER TABLE pending_winners 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Update existing rows to have 0 points (if column was just added)
UPDATE pending_winners 
SET points = 0 
WHERE points IS NULL;
```

### Step 3: Verify Migration

After running the SQL, verify the columns were added:

```sql
-- Check players table structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name = 'points';

-- Check pending_winners table structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'pending_winners' 
AND column_name = 'points';
```

Both queries should return a row showing the `points` column with type `integer` and default `0`.

## What Happens After Migration?

- **Existing players**: Will have `points = 0` (they keep their wins)
- **New players**: Will start with `points = 0` 
- **New battles**: Will award points (100/70/50) to top 3 players
- **Ranking**: Leaderboard will sort by points first, then wins

## Troubleshooting

If you see errors like "column points does not exist":
1. Make sure you ran the ALTER TABLE commands above
2. Check that you're connected to the correct Supabase project
3. Verify the table names match exactly (`players` and `pending_winners`)

## Rollback (if needed)

If you need to remove the points column (not recommended):

```sql
ALTER TABLE players DROP COLUMN IF EXISTS points;
ALTER TABLE pending_winners DROP COLUMN IF EXISTS points;
```
