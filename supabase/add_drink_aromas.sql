-- ==============================================================================
-- PASSI: DRINK AROMAS & FLAVORS (ARÔMES & GOÛTS) MIGRATION
-- ==============================================================================
-- Run this script in your Supabase SQL Editor.

-- 1. PASSES: Add selected_aromas column (JSONB array of checked aromas/flavors)
ALTER TABLE public.passes
ADD COLUMN IF NOT EXISTS selected_aromas JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_passes_selected_aromas ON public.passes USING GIN (selected_aromas);

-- 2. EVENTS: Add drinks JSONB column (Stores [{ "name": "Mojito", "aromas": ["Fraise", "Passion"] }])
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS drinks JSONB DEFAULT '[]'::jsonb;

-- 3. DRINK_MENUS: Add aromas JSONB column for relational drink entries
ALTER TABLE public.drink_menus
ADD COLUMN IF NOT EXISTS aromas JSONB DEFAULT '[]'::jsonb;

-- 4. UPDATE RPC: create_pass_with_pricing with p_selected_aromas support
DROP FUNCTION IF EXISTS create_pass_with_pricing(UUID, UUID, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_pass_with_pricing(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_drink_id UUID,
  p_promo_code TEXT DEFAULT NULL,
  p_selected_aromas JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  -- 1. Fetch event pricing and promos
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

  -- 3. Insert Pass with selected_aromas
  INSERT INTO passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    entry_status,
    final_price,
    promo_used,
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
    p_drink_id,
    CASE WHEN p_drink_id IS NOT NULL THEN 'pending' ELSE NULL END,
    COALESCE(p_selected_aromas, '[]'::jsonb)
  ) RETURNING id INTO v_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'pass_id', v_pass_id,
    'final_price', v_final_price,
    'promo_used', v_promo_matched
  );
END;
$$;

-- Grant permissions for RPC
GRANT EXECUTE ON FUNCTION create_pass_with_pricing(UUID, UUID, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
