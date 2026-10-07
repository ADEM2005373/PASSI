-- Supabase Schema Updates for Multi-Stage Rejection and Immutability

-- 1. Add new columns to the passes table for rejection reason and tracking updates
ALTER TABLE public.passes
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Modify entry_status check constraint or enum type
-- Note: If you are using an ENUM for entry_status, you'll need to add 'rejected' to it:
-- ALTER TYPE entry_status_enum ADD VALUE IF NOT EXISTS 'rejected';

-- If you are using a CHECK constraint instead of an ENUM:
-- ALTER TABLE public.passes DROP CONSTRAINT IF EXISTS passes_entry_status_check;
-- ALTER TABLE public.passes ADD CONSTRAINT passes_entry_status_check 
-- CHECK (entry_status IN ('pending', 'awaiting_payment', 'activated', 'scanned', 'rejected'));

-- 3. (Optional) Prevent deletion or updates on PAID passes at the database level via a trigger
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

    -- If trying to modify a finalized pass (unless it's just scanning it)
    IF TG_OP = 'UPDATE' THEN
        -- Allow transition from activated to scanned
        IF OLD.entry_status = 'activated' AND NEW.entry_status = 'scanned' THEN
            RETURN NEW;
        END IF;

        IF OLD.entry_status IN ('activated', 'scanned') THEN
            RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_pass_immutability ON public.passes;
CREATE TRIGGER enforce_pass_immutability
BEFORE UPDATE OR DELETE ON public.passes
FOR EACH ROW
EXECUTE FUNCTION prevent_paid_pass_modification();
