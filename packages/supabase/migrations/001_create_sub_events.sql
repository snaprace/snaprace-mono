-- ============================================================================
-- Migration: Create sub_events table and update event_runners
-- Description: Normalize category data from event_runners into sub_events table
-- ============================================================================

-- 1. Create sub_events table
CREATE TABLE IF NOT EXISTS sub_events (
  sub_event_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  
  -- Category identification
  name TEXT NOT NULL,           -- Display name (e.g., "Marathon", "Half Marathon")
  slug TEXT NOT NULL,           -- URL/matching key (e.g., "marathon", "half-marathon")
  
  -- Metadata (moved from event_runners)
  distance_km NUMERIC,
  distance_mi NUMERIC,
  is_relay BOOLEAN DEFAULT FALSE,
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: slug must be unique within an event
  UNIQUE(event_id, slug)
);

-- 2. Create index for sub_events
CREATE INDEX IF NOT EXISTS idx_sub_events_event_id ON sub_events(event_id);

-- 3. Enable RLS for sub_events
ALTER TABLE sub_events ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for sub_events (public read access)
CREATE POLICY "sub_events are viewable by everyone" 
  ON sub_events 
  FOR SELECT 
  USING (true);

-- 5. Add sub_event_id column to event_runners
ALTER TABLE event_runners 
  ADD COLUMN IF NOT EXISTS sub_event_id UUID REFERENCES sub_events(sub_event_id) ON DELETE CASCADE;

-- 6. Create index for event_runners.sub_event_id
CREATE INDEX IF NOT EXISTS idx_event_runners_sub_event_id ON event_runners(sub_event_id);

-- 7. Clear existing data (optional - uncomment if you want to start fresh)
-- TRUNCATE TABLE event_runners CASCADE;

