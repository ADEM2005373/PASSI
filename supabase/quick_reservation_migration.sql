-- ==============================================================================
-- PASSI: EXPRESS GUEST RESERVATION FLOW MIGRATION
-- ==============================================================================
-- Supports:
-- 1. Dual Flow Coexistence (source: 'QUICK_RESERVATION' vs 'STANDARD')
-- 2. Nullable user_id for guest checkouts
-- 3. Contact details (phone, email) directly on passes
-- 4. Unique reservation_code (e.g. QCK-AB12CD)
-- 5. Statuses: PENDING_PAYMENT, PAID, EXPIRED, CANCELLED
-- 6. expires_at visual reference timestamp (createdAt + 48 hours)
-- 7. selected_drink & optional instagram
-- 8. Automatic post-registration / login linking trigger
-- ==============================================================================

-- 1. Ensure user_id is NULLABLE on passes table
ALTER TABLE public.passes 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add columns to passes table if not exists
DO $$
BEGIN
  -- Origin/Flow source column ('QUICK_RESERVATION' vs 'STANDARD')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN source TEXT DEFAULT 'STANDARD' NOT NULL;
  END IF;

  -- Reservation Code for easy POS search (e.g. QCK-7A3B9C)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'reservation_code'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN reservation_code TEXT DEFAULT NULL;
  END IF;

  -- Guest Contact: Phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN phone TEXT DEFAULT NULL;
  END IF;

  -- Guest Contact: Email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN email TEXT DEFAULT NULL;
  END IF;

  -- Guest Instagram (optional/null)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'instagram'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN instagram TEXT DEFAULT NULL;
  END IF;

  -- Selected Drink
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'selected_drink'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN selected_drink TEXT DEFAULT NULL;
  END IF;

  -- Lifecycle Status: PENDING_PAYMENT, PAID, EXPIRED, CANCELLED
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN status TEXT DEFAULT 'PENDING_PAYMENT' NOT NULL;
  END IF;

  -- Expiration timestamp (createdAt + 48 hours for visual reference)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- Dynamic Web Pass: Secret Token for public URL /p/:secretToken
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'secret_token'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN secret_token TEXT UNIQUE DEFAULT NULL;
  END IF;

  -- Entry Gate QR Token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'entry_token'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN entry_token TEXT UNIQUE DEFAULT NULL;
  END IF;

  -- Entry Gate Consumption Flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'is_entry_used'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN is_entry_used BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- Entry Gate Scanned Timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'entry_used_at'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN entry_used_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- Drink Voucher QR Token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'drink_token'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN drink_token TEXT UNIQUE DEFAULT NULL;
  END IF;

  -- Drink Voucher Consumption Flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'is_drink_used'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN is_drink_used BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- POS Direct Issuance: Location Name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'issued_by_pos'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN issued_by_pos TEXT DEFAULT NULL;
  END IF;

  -- POS Direct Issuance: Cashier / Operator ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'cashier_id'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN cashier_id UUID DEFAULT NULL;
  END IF;

  -- Payment Status tracking ('paid', 'pending', etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN payment_status TEXT DEFAULT NULL;
  END IF;

  -- Optional Full Name column (convenience alias for guest name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN full_name TEXT DEFAULT NULL;
  END IF;

  -- Optional Total Price column (convenience alias for final price)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE public.passes ADD COLUMN total_price NUMERIC DEFAULT NULL;
  END IF;
END $$;

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_passes_source ON public.passes(source);
CREATE INDEX IF NOT EXISTS idx_passes_reservation_code ON public.passes(reservation_code);
CREATE INDEX IF NOT EXISTS idx_passes_email ON public.passes(email);
CREATE INDEX IF NOT EXISTS idx_passes_phone ON public.passes(phone);
CREATE INDEX IF NOT EXISTS idx_passes_status ON public.passes(status);
CREATE INDEX IF NOT EXISTS idx_passes_expires_at ON public.passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_passes_secret_token ON public.passes(secret_token);
CREATE INDEX IF NOT EXISTS idx_passes_entry_token ON public.passes(entry_token);
CREATE INDEX IF NOT EXISTS idx_passes_drink_token ON public.passes(drink_token);
CREATE INDEX IF NOT EXISTS idx_passes_issued_by_pos ON public.passes(issued_by_pos);
CREATE INDEX IF NOT EXISTS idx_passes_cashier_id ON public.passes(cashier_id);

-- 4. Automatic Account Sync Trigger:
-- When a new user account is created or profile inserted, automatically link
-- any previously created guest reservations matching that email to this user_id.
CREATE OR REPLACE FUNCTION sync_guest_passes_on_profile_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
    UPDATE public.passes
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE user_id IS NULL
      AND (
        LOWER(TRIM(COALESCE(email, ''))) = LOWER(TRIM(NEW.email))
        OR LOWER(TRIM(COALESCE(guest_email, ''))) = LOWER(TRIM(NEW.email))
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_guest_passes_on_profile_create ON public.profiles;
CREATE TRIGGER trigger_sync_guest_passes_on_profile_create
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION sync_guest_passes_on_profile_create();

-- 5. Capacity column on events (if missing)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT NULL;

-- 6. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
