-- Add new drink columns to passes table
ALTER TABLE passes 
ADD COLUMN IF NOT EXISTS drink_id UUID REFERENCES drink_menus(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS drink_status TEXT,
ADD COLUMN IF NOT EXISTS drink_qr_uuid UUID;

-- Now create or replace the function
CREATE OR REPLACE FUNCTION create_pass(
  p_user_id UUID,
  p_event_id UUID,
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_drink_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO passes (
    user_id,
    event_id,
    guest_first_name,
    guest_last_name,
    entry_status,
    drink_id,
    drink_status
  ) VALUES (
    p_user_id,
    p_event_id,
    p_guest_first_name,
    p_guest_last_name,
    'pending',
    p_drink_id,
    CASE WHEN p_drink_id IS NOT NULL THEN 'pending' ELSE NULL END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
