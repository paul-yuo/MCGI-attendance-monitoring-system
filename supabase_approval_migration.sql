-- ====================================================================
-- SUPABASE MIGRATION: Add User Approval & QR Activation Lifecycle Fields
-- ====================================================================
-- This migration safely adds registration approval and QR activation columns
-- to both `auth_users` and `members` tables.
--
-- Backward-compatible: Existing records are migrated to 'ACTIVE' and qr_active = TRUE
-- so no current active users or administrators are locked out.
-- ====================================================================

DO $$
BEGIN
  -- ─────────────────────────────────────────────────────────────
  -- Table: auth_users
  -- ─────────────────────────────────────────────────────────────

  -- 1. status ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN status TEXT DEFAULT 'ACTIVE';
  END IF;

  -- 2. approved_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- 3. approved_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN approved_by TEXT;
  END IF;

  -- 4. rejected_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  -- 5. rejected_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN rejected_by TEXT;
  END IF;

  -- 6. qr_active (true when QR is enabled for attendance)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'qr_active'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN qr_active BOOLEAN DEFAULT TRUE;
  END IF;

  -- 7. qr_created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'qr_created_at'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN qr_created_at TIMESTAMPTZ;
  END IF;

  -- 8. qr_code (stored encrypted payload string)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE public.auth_users ADD COLUMN qr_code TEXT;
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- Table: members
  -- ─────────────────────────────────────────────────────────────

  -- 9. status on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.members ADD COLUMN status TEXT DEFAULT 'ACTIVE';
  END IF;

  -- 10. qr_active on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'qr_active'
  ) THEN
    ALTER TABLE public.members ADD COLUMN qr_active BOOLEAN DEFAULT TRUE;
  END IF;

  -- 11. qr_code on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE public.members ADD COLUMN qr_code TEXT;
  END IF;

  -- 12. approved_at on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.members ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- 13. approved_by on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.members ADD COLUMN approved_by TEXT;
  END IF;

  -- 14. rejected_at on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE public.members ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  -- 15. rejected_by on members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE public.members ADD COLUMN rejected_by TEXT;
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────
-- Data Migration / Backward Compatibility:
-- Guarantee all existing records are marked 'ACTIVE' and 'qr_active = TRUE'
-- ─────────────────────────────────────────────────────────────
UPDATE public.auth_users
SET 
  status = 'ACTIVE',
  qr_active = COALESCE(qr_active, TRUE)
WHERE status IS NULL OR status = '' OR status = 'Active';

UPDATE public.members
SET 
  status = 'ACTIVE',
  qr_active = COALESCE(qr_active, TRUE)
WHERE status IS NULL OR status = '' OR status = 'Active';

-- Create helpful index for pending review queries
CREATE INDEX IF NOT EXISTS idx_auth_users_status_duty 
ON public.auth_users (ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_members_status_duty 
ON public.members (ministry_id, status);
