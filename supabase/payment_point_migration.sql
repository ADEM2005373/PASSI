-- ==============================================================================
-- PASSI: PAYMENT POINT MIGRATION, PRICING, PROMO CODES & FINANCIAL TRACKING
-- ==============================================================================

-- 1. PROFILES / USERS: Update user_role ENUM (if enum exists) & add is_suspended
-- Safely handle both setups: when user_role is an ENUM, or when role is plain TEXT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typtype = 'e') THEN
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PAYMENT_POINT';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'payment_point';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

-- Add is_suspended column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false NOT NULL;

-- 2. EVENTS: Add base_price & promo_codes JSONB
ALTER TABLE events
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS promo_codes JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 3. PASSES: Add final_price, promo_used, payment_point_id, payment_approved_at
ALTER TABLE passes
ADD COLUMN IF NOT EXISTS final_price NUMERIC(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS promo_used TEXT,
ADD COLUMN IF NOT EXISTS payment_point_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMP WITH TIME ZONE;

-- Add index on payment_point_id and status for fast reporting
CREATE INDEX IF NOT EXISTS idx_passes_payment_point_id ON passes(payment_point_id);
CREATE INDEX IF NOT EXISTS idx_passes_entry_status ON passes(entry_status);
CREATE INDEX IF NOT EXISTS idx_passes_payment_approved_at ON passes(payment_approved_at);

-- 4. RLS POLICIES FOR PAYMENT_POINT
-- Drop existing policies if any to prevent duplicate policy errors
DROP POLICY IF EXISTS "Payment points can read events" ON events;
DROP POLICY IF EXISTS "Payment points can read awaiting payment passes" ON passes;
DROP POLICY IF EXISTS "Payment points can update passes" ON passes;

-- Payment point workers can read all events
CREATE POLICY "Payment points can read events" ON events 
FOR SELECT USING (
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'payment_point'
);

-- Payment point workers can read passes awaiting payment or pending
CREATE POLICY "Payment points can read awaiting payment passes" ON passes 
FOR SELECT USING (
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'payment_point' 
  AND COALESCE((SELECT is_suspended FROM profiles WHERE id = auth.uid()), false) = false
);

-- Payment point workers can update passes to approve cash
CREATE POLICY "Payment points can update passes" ON passes 
FOR UPDATE USING (
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'payment_point' 
  AND COALESCE((SELECT is_suspended FROM profiles WHERE id = auth.uid()), false) = false
);

-- 5. UPDATE RPC: create_pass with promo validation & final_price calculation
CREATE OR REPLACE FUNCTION create_pass_with_pricing(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_drink_id UUID,
  p_promo_code TEXT DEFAULT NULL
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

  -- 3. Insert Pass
  INSERT INTO passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    entry_status,
    final_price,
    promo_used,
    drink_id,
    drink_status
  ) VALUES (
    p_user_id,
    p_event_id,
    p_guest_first_name,
    p_guest_last_name,
    'pending',
    v_final_price,
    v_promo_matched,
    p_drink_id,
    CASE WHEN p_drink_id IS NOT NULL THEN 'pending' ELSE NULL END
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
GRANT EXECUTE ON FUNCTION create_pass_with_pricing(UUID, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
