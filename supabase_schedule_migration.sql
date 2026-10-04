-- ====================================================================
-- SUPABASE MIGRATION: Add Schedule Metadata to Attendance Records
-- ====================================================================
-- This migration safely adds schedule tracking columns to the
-- `attendance_records` table, enabling cloud persistence for:
--  - scheduled_time (e.g. '5:30 PM')
--  - schedule_day (e.g. 'Sunday')
--  - session_type (e.g. 'LIVE' or 'VIEWING')
--  - schedule_slot (e.g. '5:30PM/SUN - VIEWING')
--  - schedule_auto_detected (boolean flag)
--
-- Backward-compatible: all columns are NULLABLE so existing rows remain valid.
-- Run this in the Supabase SQL Editor for your project.
-- ====================================================================

DO $$
BEGIN
  -- 1. scheduled_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'scheduled_time'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN scheduled_time TEXT;
  END IF;

  -- 2. schedule_day
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'schedule_day'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN schedule_day TEXT;
  END IF;

  -- 3. session_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'session_type'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN session_type TEXT;
  END IF;

  -- 4. schedule_slot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'schedule_slot'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN schedule_slot TEXT;
  END IF;

  -- 5. schedule_auto_detected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'schedule_auto_detected'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN schedule_auto_detected BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Optional index for filtering and reporting by schedule
CREATE INDEX IF NOT EXISTS idx_attendance_records_schedule 
ON public.attendance_records (event_type, schedule_day, scheduled_time);
