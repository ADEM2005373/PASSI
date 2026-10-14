-- ==============================================================================
-- Migration: Fix "Invalid input syntax for type uuid" on Pass Reservation
-- Description:
--   1. Converts passes.drink_id to TEXT and drops any foreign key constraint.
--   2. Adds passes.drink_name (TEXT) and passes.selected_aromas (JSONB).
--   3. Recreates create_pass_with_pricing RPC accepting p_drink_name (TEXT).
--   4. Recreates create_pass RPC accepting p_drink_name (TEXT).
--   5. Stores drink in BOTH drink_id & drink_name for 100% backward/forward compatibility.
-- ==============================================================================

-- 1. Schema Updates (Idempotent block)
DO $setup$
BEGIN
  -- Drop foreign key constraint on drink_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'passes_drink_id_fkey' AND table_name = 'passes'
  ) THEN
    ALTER TABLE passes DROP CONSTRAINT passes_drink_id_fkey;
  END IF;

  -- If drink_id column exists, convert to TEXT so arbitrary drink strings can be stored
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_id'
  ) THEN
    ALTER TABLE passes ALTER COLUMN drink_id DROP DEFAULT;
    ALTER TABLE passes ALTER COLUMN drink_id TYPE TEXT USING drink_id::text;
  ELSE
    ALTER TABLE passes ADD COLUMN drink_id TEXT;
  END IF;

  -- Ensure drink_name column exists as TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_name'
  ) THEN
    ALTER TABLE passes ADD COLUMN drink_name TEXT;
  END IF;

  -- Ensure selected_aromas column exists as JSONB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'selected_aromas'
  ) THEN
    ALTER TABLE passes ADD COLUMN selected_aromas JSONB DEFAULT '[]'::jsonb;
  END IF;
END;
$setup$;

-- 2. Clean up any existing overloaded RPC signatures
DROP FUNCTION IF EXISTS create_pass_with_pricing(UUID, UUID, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS create_pass_with_pricing(UUID, UUID, TEXT, TEXT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_pass_with_pricing(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_pass_with_pricing(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB);

-- 3. Re-create create_pass_with_pricing RPC
CREATE OR REPLACE FUNCTION create_pass_with_pricing(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_drink_name TEXT DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL,
  p_selected_aromas JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_base_price NUMERIC(10, 2);
  v_promo_codes JSONB;
  v_discount NUMERIC(10, 2) := 0;
  v_final_price NUMERIC(10, 2);
  v_promo_matched TEXT := NULL;
  v_elem JSONB;
  v_code TEXT;
  v_disc NUMERIC(10, 2);
  v_pass_id UUID;
BEGIN
  -- 1. Fetch event pricing and promo codes
  SELECT COALESCE(base_price, 0), COALESCE(promo_codes, '[]'::jsonb)
  INTO v_base_price, v_promo_codes
  FROM events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 2. Validate promo code if provided
  IF p_promo_code IS NOT NULL AND TRIM(p_promo_code) <> '' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_promo_codes)
    LOOP
      v_code := v_elem->>'code';
      IF UPPER(TRIM(v_code)) = UPPER(TRIM(p_promo_code)) THEN
        v_disc := COALESCE((v_elem->>'discount_amount')::numeric, 0);
        v_discount := v_disc;
        v_promo_matched := UPPER(TRIM(v_code));
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Calculate final price (cannot be negative)
  v_final_price := GREATEST(0, v_base_price - v_discount);

  -- 3. Insert Pass storing drink into both drink_name and drink_id (both TEXT)
  INSERT INTO passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    entry_status,
    final_price,
    promo_used,
    drink_name,
    drink_id,
    drink_status,
    selected_aromas
  ) VALUES (
    p_user_id,
    p_event_id,
    p_guest_first_name,
    p_guest_last_name,
    'pending',
    v_final_price,
    v_promo_matched,
    p_drink_name,
    p_drink_name,
    CASE WHEN p_drink_name IS NOT NULL AND TRIM(p_drink_name) <> '' THEN 'pending' ELSE NULL END,
    COALESCE(p_selected_aromas, '[]'::jsonb)
  ) RETURNING id INTO v_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'pass_id', v_pass_id,
    'final_price', v_final_price,
    'promo_used', v_promo_matched
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION create_pass_with_pricing(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- 4. Re-create fallback create_pass RPC
DROP FUNCTION IF EXISTS create_pass(UUID, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_pass(UUID, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_pass(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_drink_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    entry_status,
    drink_name,
    drink_id,
    drink_status
  ) VALUES (
    p_user_id,
    p_event_id,
    p_guest_first_name,
    p_guest_last_name,
    'pending',
    p_drink_name,
    p_drink_name,
    CASE WHEN p_drink_name IS NOT NULL AND TRIM(p_drink_name) <> '' THEN 'pending' ELSE NULL END
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION create_pass(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
