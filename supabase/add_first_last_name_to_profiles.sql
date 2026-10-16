-- ==============================================================================
-- PASSI: ADD FIRST_NAME & LAST_NAME TO PROFILES + PASSES APPROVER AUDIT FK
-- ==============================================================================

-- 1. Ensure first_name and last_name exist on profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Populate first_name and last_name from full_name if available
UPDATE public.profiles 
SET 
  first_name = COALESCE(first_name, NULLIF(split_part(TRIM(full_name), ' ', 1), '')),
  last_name = COALESCE(last_name, NULLIF(substr(TRIM(full_name), length(split_part(TRIM(full_name), ' ', 1)) + 2), ''))
WHERE full_name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- 3. Ensure approved_by column exists on passes with foreign key passes_approved_by_fkey
ALTER TABLE public.passes 
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;

-- 4. Ensure foreign key constraint passes_approved_by_fkey exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'passes_approved_by_fkey'
  ) THEN
    ALTER TABLE public.passes 
    ADD CONSTRAINT passes_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Create index for high performance queries
CREATE INDEX IF NOT EXISTS idx_passes_approved_by ON public.passes(approved_by);
CREATE INDEX IF NOT EXISTS idx_passes_payment_approved_at ON public.passes(payment_approved_at);
