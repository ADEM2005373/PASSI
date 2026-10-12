-- ==============================================================================
-- PASSI: SPECIAL PASS TYPES (NORMAL, GIFT, INVITATION, VIP) & DRINK SELECTION
-- ==============================================================================

-- 1. Add columns to passes table
DO $$
BEGIN
  -- Add pass_type column (NORMAL, GIFT, INVITATION, VIP)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'pass_type'
  ) THEN
    ALTER TABLE passes ADD COLUMN pass_type TEXT DEFAULT 'NORMAL' NOT NULL;
  END IF;

  -- Add invitation_status column (PENDING, ACCEPTED, DECLINED)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'invitation_status'
  ) THEN
    ALTER TABLE passes ADD COLUMN invitation_status TEXT DEFAULT NULL;
  END IF;

  -- Add drink_id foreign key if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_id'
  ) THEN
    ALTER TABLE passes ADD COLUMN drink_id UUID REFERENCES drink_menus(id) ON DELETE SET NULL;
  END IF;

  -- Add drink_qr_code column (string representation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_qr_code'
  ) THEN
    ALTER TABLE passes ADD COLUMN drink_qr_code TEXT DEFAULT NULL;
  END IF;

  -- Add drink_qr_uuid column (UUID representation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_qr_uuid'
  ) THEN
    ALTER TABLE passes ADD COLUMN drink_qr_uuid UUID DEFAULT NULL;
  END IF;

  -- Add drink_status column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_status'
  ) THEN
    ALTER TABLE passes ADD COLUMN drink_status TEXT DEFAULT NULL;
  END IF;
END$$;

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_passes_pass_type ON passes(pass_type);
CREATE INDEX IF NOT EXISTS idx_passes_invitation_status ON passes(invitation_status);
CREATE INDEX IF NOT EXISTS idx_passes_drink_id ON passes(drink_id);

-- 3. RLS Policies update
-- Allow users to read their own passes with any pass_type
DROP POLICY IF EXISTS "Users can read own passes" ON passes;
CREATE POLICY "Users can read own passes" ON passes 
FOR SELECT USING (auth.uid() = user_id);

-- Allow users to update their own invitation status & drink selection
DROP POLICY IF EXISTS "Users can update own passes" ON passes;
CREATE POLICY "Users can update own passes" ON passes 
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
