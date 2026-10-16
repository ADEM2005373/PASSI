-- ==============================================================================
-- Migration: Admin Pass Creation RPC with Drink, Aroma & Promo Code Selection
-- Description:
--   1. Ensures passes table has drink_name (TEXT), selected_aromas (JSONB), and promo_used (TEXT).
--   2. Updates `create_admin_pass` RPC accepting p_promo_code to calculate dynamic discounts on NORMAL passes.
--   3. Automatically stores promo_used and discounted final_price in passes table.
-- ==============================================================================

-- 1. Ensure required columns exist on public.passes
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_name'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN drink_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'selected_aromas'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN selected_aromas JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'pass_type'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN pass_type TEXT DEFAULT 'NORMAL' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_status'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN drink_status TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_qr_uuid'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN drink_qr_uuid UUID DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'promo_used'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN promo_used TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN final_price NUMERIC(10, 2) DEFAULT 0;
  END IF;
END;
$migration$;

-- 2. Drop existing functions if any
DROP FUNCTION IF EXISTS public.create_admin_pass(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_admin_pass(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.generate_vip_pass(UUID, UUID, TEXT, TEXT, TEXT, JSONB);

-- 3. Create or Replace `create_admin_pass` RPC with Promo Code support
CREATE OR REPLACE FUNCTION public.create_admin_pass(
  p_user_id UUID,
  p_event_id UUID,
  p_pass_type TEXT DEFAULT 'VIP',
  p_guest_first_name TEXT DEFAULT NULL,
  p_guest_last_name TEXT DEFAULT NULL,
  p_drink_name TEXT DEFAULT NULL,
  p_selected_aromas JSONB DEFAULT '[]'::jsonb,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_normalized_type TEXT;
  v_entry_status TEXT := 'pending';
  v_entry_qr_uuid UUID := NULL;
  v_invitation_status TEXT := NULL;
  v_final_price NUMERIC(10, 2) := 0;
  v_event_base_price NUMERIC(10, 2) := 0;
  v_event_promos JSONB := '[]'::jsonb;
  v_promo_matched TEXT := NULL;
  v_disc NUMERIC(10, 2) := 0;
  v_drink_status TEXT := NULL;
  v_drink_qr_uuid UUID := NULL;
  v_clean_drink_name TEXT;
  v_clean_first_name TEXT;
  v_clean_last_name TEXT;
  v_user_full_name TEXT;
  v_user_email TEXT;
  v_pass_id UUID;
  v_new_pass JSONB;
BEGIN
  -- Normalize pass_type (CADEAU maps to GIFT)
  v_normalized_type := UPPER(TRIM(COALESCE(p_pass_type, 'VIP')));
  IF v_normalized_type = 'CADEAU' THEN
    v_normalized_type := 'GIFT';
  ELSIF v_normalized_type NOT IN ('VIP', 'GIFT', 'INVITATION', 'NORMAL') THEN
    v_normalized_type := 'VIP';
  END IF;

  -- Clean drink name
  v_clean_drink_name := NULLIF(TRIM(COALESCE(p_drink_name, '')), '');

  -- Determine statuses & QR codes based on pass type
  IF v_normalized_type IN ('VIP', 'GIFT') THEN
    v_entry_status := 'activated';
    v_entry_qr_uuid := gen_random_uuid();
    v_final_price := 0;
    v_invitation_status := NULL;

    IF v_clean_drink_name IS NOT NULL THEN
      v_drink_status := 'activated';
      v_drink_qr_uuid := gen_random_uuid();
    END IF;
  ELSIF v_normalized_type = 'INVITATION' THEN
    v_entry_status := 'pending';
    v_entry_qr_uuid := NULL;
    v_final_price := 0;
    v_invitation_status := 'PENDING';

    IF v_clean_drink_name IS NOT NULL THEN
      v_drink_status := 'pending';
      v_drink_qr_uuid := NULL;
    END IF;
  ELSE
    -- NORMAL: Calculate price and apply promo code if valid
    v_entry_status := 'pending';
    v_entry_qr_uuid := NULL;
    v_invitation_status := NULL;

    SELECT COALESCE(base_price, 0), COALESCE(promo_codes, '[]'::jsonb)
    INTO v_event_base_price, v_event_promos 
    FROM events WHERE id = p_event_id;

    v_final_price := v_event_base_price;

    IF p_promo_code IS NOT NULL AND TRIM(p_promo_code) <> '' THEN
      SELECT TRIM(UPPER(elem->>'code')), COALESCE((elem->>'discount_amount')::numeric, 0)
      INTO v_promo_matched, v_disc
      FROM jsonb_array_elements(v_event_promos) AS elem
      WHERE TRIM(UPPER(elem->>'code')) = TRIM(UPPER(p_promo_code))
      LIMIT 1;

      IF v_promo_matched IS NOT NULL THEN
        v_final_price := GREATEST(0, v_event_base_price - v_disc);
      END IF;
    END IF;

    IF v_clean_drink_name IS NOT NULL THEN
      v_drink_status := 'pending';
      v_drink_qr_uuid := NULL;
    END IF;
  END IF;

  -- Resolve names if not explicitly provided
  v_clean_first_name := TRIM(COALESCE(p_guest_first_name, ''));
  v_clean_last_name := TRIM(COALESCE(p_guest_last_name, ''));

  IF v_clean_first_name = '' THEN
    SELECT full_name, email INTO v_user_full_name, v_user_email FROM profiles WHERE id = p_user_id;
    IF v_user_full_name IS NOT NULL AND TRIM(v_user_full_name) <> '' THEN
      v_clean_first_name := split_part(TRIM(v_user_full_name), ' ', 1);
      IF v_clean_last_name = '' THEN
        v_clean_last_name := substr(TRIM(v_user_full_name), length(v_clean_first_name) + 2);
      END IF;
    ELSE
      v_clean_first_name := COALESCE(split_part(v_user_email, '@', 1), 'Invité');
    END IF;
  END IF;

  -- Insert into passes table
  INSERT INTO public.passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    pass_type,
    invitation_status,
    entry_status,
    entry_qr_uuid,
    final_price,
    promo_used,
    drink_name,
    drink_id,
    selected_aromas,
    drink_status,
    drink_qr_uuid,
    drink_qr_code
  ) VALUES (
    p_user_id,
    p_event_id,
    v_clean_first_name,
    v_clean_last_name,
    v_normalized_type,
    v_invitation_status,
    v_entry_status::pass_status,
    v_entry_qr_uuid,
    v_final_price,
    v_promo_matched,
    v_clean_drink_name,
    v_clean_drink_name,
    COALESCE(p_selected_aromas, '[]'::jsonb),
    v_drink_status,
    v_drink_qr_uuid,
    v_drink_qr_uuid::text
  )
  RETURNING id INTO v_pass_id;

  SELECT row_to_json(p.*) INTO v_new_pass
  FROM passes p
  WHERE p.id = v_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'pass_id', v_pass_id,
    'pass', v_new_pass,
    'pass_type', v_normalized_type,
    'final_price', v_final_price,
    'promo_used', v_promo_matched,
    'drink_name', v_clean_drink_name,
    'selected_aromas', COALESCE(p_selected_aromas, '[]'::jsonb)
  );
END;
$func$;

-- 4. Create `generate_vip_pass` helper RPC
CREATE OR REPLACE FUNCTION public.generate_vip_pass(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT DEFAULT NULL,
  p_guest_last_name TEXT DEFAULT NULL,
  p_drink_name TEXT DEFAULT NULL,
  p_selected_aromas JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  RETURN public.create_admin_pass(
    p_user_id => p_user_id,
    p_event_id => p_event_id,
    p_pass_type => 'VIP',
    p_guest_first_name => p_guest_first_name,
    p_guest_last_name => p_guest_last_name,
    p_drink_name => p_drink_name,
    p_selected_aromas => p_selected_aromas
  );
END;
$func$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_admin_pass(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_vip_pass(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
