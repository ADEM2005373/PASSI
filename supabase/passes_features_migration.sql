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

-- 4. Fix Immutability Trigger to allow Drink Selection & Drink Scanning on Activated / VIP / Paid Passes
CREATE OR REPLACE FUNCTION prevent_paid_pass_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- If trying to delete a finalized pass
    IF TG_OP = 'DELETE' THEN
        IF OLD.entry_status IN ('activated', 'scanned') THEN
            RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    -- If trying to modify a pass
    IF TG_OP = 'UPDATE' THEN
        -- If the pass was already finalized/activated or scanned
        IF OLD.entry_status IN ('activated', 'scanned') THEN
            -- Prevent modifying critical ticket properties (user_id, event_id, price)
            IF (OLD.user_id <> NEW.user_id) 
               OR (OLD.event_id <> NEW.event_id) 
               OR (OLD.final_price <> NEW.final_price) THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            -- Prevent rolling back entry status from activated to pending or rejected
            IF OLD.entry_status = 'activated' AND NEW.entry_status NOT IN ('activated', 'scanned') THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            -- Prevent rolling back from scanned
            IF OLD.entry_status = 'scanned' AND NEW.entry_status <> 'scanned' THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            -- ALLOW updating drink fields (drink_id, drink_status, drink_qr_uuid, drink_qr_code, updated_at)
            -- and entry scanning (activated -> scanned)
            RETURN NEW;
        END IF;

        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS enforce_pass_immutability ON public.passes;
CREATE TRIGGER enforce_pass_immutability
BEFORE UPDATE OR DELETE ON public.passes
FOR EACH ROW
EXECUTE FUNCTION prevent_paid_pass_modification();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
