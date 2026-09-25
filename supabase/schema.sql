-- Users/Profiles Table
-- Tied to Supabase Auth, defines the application roles
CREATE TYPE user_role AS ENUM ('admin', 'user', 'security', 'barman');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    instagram_handle TEXT NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for pedagogical clarity and security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Security Policies
-- Users can see their own profile
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
-- Admins can read all profiles to manage roles
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
-- Admins can update roles
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
-- System handles insertions via trigger during auth.users insert, but for safety:
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT NOT NULL,
    pre_orders_enabled BOOLEAN DEFAULT false,
    max_passes_per_user INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Events Security Policies
CREATE POLICY "Anyone can read events" ON events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON events FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- Drink Menus Table
-- Linked to events
CREATE TABLE drink_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE drink_menus ENABLE ROW LEVEL SECURITY;

-- Drink Menus Security Policies
CREATE POLICY "Anyone can read drink menus" ON drink_menus FOR SELECT USING (true);
CREATE POLICY "Admins can manage drink menus" ON drink_menus FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- Passes Table (The Core Engine)
-- Implements the Waitlist -> Cash Verification State Machine
CREATE TYPE pass_status AS ENUM ('pending', 'awaiting_payment', 'activated', 'scanned');

CREATE TABLE passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_first_name TEXT,
    guest_last_name TEXT,
    -- entry_qr_uuid is only generated when status becomes 'activated'
    entry_qr_uuid UUID UNIQUE,
    entry_status pass_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- Passes Security Policies
-- Users can only access their own passes
CREATE POLICY "Users can read own passes" ON passes FOR SELECT USING (auth.uid() = user_id);
-- Admins need access to all passes to verify payments
CREATE POLICY "Admins can read all passes" ON passes FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
-- Security needs access to scan the QR UUIDs
CREATE POLICY "Security can read all passes" ON passes FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'security');
CREATE POLICY "Admins can update passes" ON passes FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
-- Security can only update passes (status -> scanned)
CREATE POLICY "Security can update passes" ON passes FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'security');
CREATE POLICY "Users can insert own passes" ON passes FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Pass Drinks Table
CREATE TYPE drink_status AS ENUM ('pending', 'awaiting_payment', 'activated', 'scanned');

CREATE TABLE pass_drinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES passes(id) ON DELETE CASCADE,
    drink_id UUID REFERENCES drink_menus(id) ON DELETE CASCADE,
    drink_qr_uuid UUID UNIQUE,
    drink_status drink_status DEFAULT 'pending' NOT NULL
);

ALTER TABLE pass_drinks ENABLE ROW LEVEL SECURITY;

-- Pass Drinks Security Policies
CREATE POLICY "Users can read own pass drinks" ON pass_drinks FOR SELECT USING (
    (SELECT user_id FROM passes WHERE id = pass_id) = auth.uid()
);
CREATE POLICY "Admins can read all pass drinks" ON pass_drinks FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
-- Barmen need access to read and update (scan) drink passes
CREATE POLICY "Barmen can read all pass drinks" ON pass_drinks FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'barman');
CREATE POLICY "Admins can update pass drinks" ON pass_drinks FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Barmen can update pass drinks" ON pass_drinks FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'barman');
CREATE POLICY "Users can insert own pass drinks" ON pass_drinks FOR INSERT WITH CHECK (
    (SELECT user_id FROM passes WHERE id = pass_id) = auth.uid()
);
