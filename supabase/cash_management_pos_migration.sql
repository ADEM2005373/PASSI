-- ==============================================================================
-- PASSI: SYSTÈME CAISSIER & SUPERVISION DES POINTS DE PAIEMENT (POS CASH MANAGEMENT)
-- ==============================================================================

-- 1. Track which cashier/payment point approved each pass
ALTER TABLE passes 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;

-- Maintain backward compatibility if payment_point_id was used previously
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'passes' AND column_name = 'payment_point_id'
  ) THEN
    -- Backfill approved_by from payment_point_id if null
    UPDATE passes 
    SET approved_by = payment_point_id 
    WHERE approved_by IS NULL AND payment_point_id IS NOT NULL;
  END IF;
END $$;

-- Indexes for lightning-fast cashier analytics & reporting
CREATE INDEX IF NOT EXISTS idx_passes_approved_by ON passes(approved_by);
CREATE INDEX IF NOT EXISTS idx_passes_payment_approved_at ON passes(payment_approved_at);

-- 2. Table for Daily Register Closures (Clôtures de Caisse Journalières)
CREATE TABLE IF NOT EXISTS cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES profiles(id) NOT NULL,
  closure_date DATE NOT NULL DEFAULT CURRENT_DATE,
  passes_approved_count INT NOT NULL DEFAULT 0,
  expected_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- Calculated from passes
  declared_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- Physically counted by cashier
  discrepancy NUMERIC(10,2) GENERATED ALWAYS AS (declared_amount - expected_amount) STORED,
  status TEXT NOT NULL CHECK (status IN ('MATCHED', 'DISCREPANCY_ALERT')),
  notes TEXT, -- Explanation if there is a discrepancy
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_cashier ON cash_closures(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_closures(closure_date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_status ON cash_closures(status);

-- 3. Table for Supervisor Cash Collections (Remises de Fonds / Ramassage)
CREATE TABLE IF NOT EXISTS cash_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES profiles(id) NOT NULL,
  supervisor_name TEXT NOT NULL,
  collected_amount NUMERIC(10,2) NOT NULL,
  collection_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_collections_cashier ON cash_collections(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_time ON cash_collections(collection_time);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Cashiers can insert their own closures" ON cash_closures;
DROP POLICY IF EXISTS "Cashiers can view their own closures" ON cash_closures;
DROP POLICY IF EXISTS "Admins can view all closures" ON cash_closures;
DROP POLICY IF EXISTS "Cashiers can insert their own collections" ON cash_collections;
DROP POLICY IF EXISTS "Cashiers can view their own collections" ON cash_collections;
DROP POLICY IF EXISTS "Admins can view all collections" ON cash_collections;

-- Cashiers can insert their own closures
CREATE POLICY "Cashiers can insert their own closures" ON cash_closures
FOR INSERT WITH CHECK (
  auth.uid() = cashier_id OR
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) IN ('payment_point', 'admin')
);

-- Cashiers can view their own closures
CREATE POLICY "Cashiers can view their own closures" ON cash_closures
FOR SELECT USING (
  auth.uid() = cashier_id OR
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin'
);

-- Admins can view all closures
CREATE POLICY "Admins can view all closures" ON cash_closures
FOR ALL USING (
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin'
);

-- Cashiers can insert collections
CREATE POLICY "Cashiers can insert their own collections" ON cash_collections
FOR INSERT WITH CHECK (
  auth.uid() = cashier_id OR
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) IN ('payment_point', 'admin')
);

-- Cashiers and Admins can view collections
CREATE POLICY "Cashiers can view their own collections" ON cash_collections
FOR SELECT USING (
  auth.uid() = cashier_id OR
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin'
);

-- Admins can view all collections
CREATE POLICY "Admins can view all collections" ON cash_collections
FOR ALL USING (
  LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin'
);

-- Grant table privileges
GRANT ALL ON TABLE cash_closures TO authenticated, service_role;
GRANT ALL ON TABLE cash_collections TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
