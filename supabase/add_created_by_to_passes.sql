-- ==============================================================================
-- PASSI: ADD CREATED_BY & PASS_ORIGIN TO PASSES FOR AUDIT TRANSPARENCY
-- ==============================================================================

-- 1. Add created_by and pass_origin columns to passes table
ALTER TABLE public.passes 
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS pass_origin TEXT DEFAULT 'USER';

-- 2. Add foreign key constraint passes_created_by_fkey referencing profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'passes_created_by_fkey'
  ) THEN
    ALTER TABLE public.passes 
    ADD CONSTRAINT passes_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_passes_created_by ON public.passes(created_by);
CREATE INDEX IF NOT EXISTS idx_passes_pass_origin ON public.passes(pass_origin);

-- 4. Backfill existing passes:
-- Mark manual admin pass types (VIP, GIFT, INVITATION) as ADMIN origin
UPDATE public.passes
SET pass_origin = 'ADMIN'
WHERE pass_type IN ('VIP', 'GIFT', 'INVITATION') 
  AND (pass_origin IS NULL OR pass_origin = 'USER');
