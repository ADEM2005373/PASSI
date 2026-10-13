-- ==============================================================================
-- PASSI: NEWS / ANNOUNCEMENTS TABLE & RLS POLICIES
-- ==============================================================================
-- Table for platform news, event announcements, and updates published by admins.
-- ==============================================================================

-- 1. Create the `news` table
CREATE TABLE IF NOT EXISTS public.news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL
);

-- 2. Indexes for efficient retrieval ordered by publication date
CREATE INDEX IF NOT EXISTS idx_news_created_at ON public.news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_admin_id ON public.news(admin_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- SELECT: Allowed for all authenticated users (and anonymous visitors for public feed)
DROP POLICY IF EXISTS "Authenticated users can read news" ON public.news;
DROP POLICY IF EXISTS "Anyone can read news" ON public.news;
CREATE POLICY "Anyone can read news" 
ON public.news FOR SELECT 
USING (true);

-- INSERT: Restricted exclusively to administrators
DROP POLICY IF EXISTS "Admins can insert news" ON public.news;
CREATE POLICY "Admins can insert news" 
ON public.news FOR INSERT 
TO authenticated 
WITH CHECK (
    -- Checks is_admin() function or profile role
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (
            role::text = 'ADMIN' 
            OR role::text = 'admin' 
            OR LOWER(role::text) = 'admin'
          )
    )
);

-- UPDATE: Restricted exclusively to administrators
DROP POLICY IF EXISTS "Admins can update news" ON public.news;
CREATE POLICY "Admins can update news" 
ON public.news FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (
            role::text = 'ADMIN' 
            OR role::text = 'admin' 
            OR LOWER(role::text) = 'admin'
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (
            role::text = 'ADMIN' 
            OR role::text = 'admin' 
            OR LOWER(role::text) = 'admin'
          )
    )
);

-- DELETE: Restricted exclusively to administrators
DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
CREATE POLICY "Admins can delete news" 
ON public.news FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (
            role::text = 'ADMIN' 
            OR role::text = 'admin' 
            OR LOWER(role::text) = 'admin'
          )
    )
);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
