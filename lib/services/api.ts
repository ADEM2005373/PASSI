import { createClient } from '../supabase/client';

export type User = {
  id: string;
  email: string;
  instagram_handle: string;
  role: 'admin' | 'user' | 'security' | 'barman';
  created_at?: string;
};

export type Event = {
  id: string;
  title: string;
  date: string;
  location: string;
  pre_orders_enabled: boolean;
  max_passes_per_user: number;
  image_url?: string;
  drink_menus?: { id: string, name: string }[];
};

export type Pass = {
  id: string;
  user_id: string;
  event_id: string;
  guest_first_name: string;
  guest_last_name: string;
  entry_qr_uuid: string | null;
  entry_status: 'pending' | 'awaiting_payment' | 'activated' | 'scanned';
  instagram_handle?: string;
};

export const api = {
  // --- AUTH (OAuth only) ---

  /**
   * Initiates a social login redirect via Supabase OAuth.
   * The browser will navigate away to the provider's consent screen.
   * On return, /auth/callback handles profile creation and routing.
   */
  async signInWithOAuth(
    provider: 'google' | 'facebook',
    redirectTo?: string
  ): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
      },
    });
  },

  async getCurrentUser(): Promise<User | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return null;
    return profile as User;
  },

  async logout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  // --- EVENTS ---
  async getEvents(): Promise<Event[]> {
    const supabase = createClient();
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    return data || [];
  },

  async getEvent(id: string): Promise<Event | undefined> {
    const supabase = createClient();
    const { data } = await supabase.from('events').select('*').eq('id', id).single();
    if (!data) return undefined;
    
    // Safely attempt to fetch drinks (will return error/null if table missing)
    const { data: drinks } = await supabase.from('drink_menus').select('*').eq('event_id', id);
    
    return {
      ...data,
      drink_menus: drinks || []
    };
  },

  // --- BOOKING (Phase 1) ---
  async bookPasses(
    eventId: string, 
    userId: string, 
    guests: { firstName: string, lastName: string, drinkId?: string }[]
  ): Promise<void> {
    const supabase = createClient();
    
    // Instead of raw inserts, use the RPC to bypass PostgREST cache issues entirely
    for (const guest of guests) {
      const { error } = await supabase.rpc('create_pass', {
        p_user_id: userId,
        p_event_id: eventId,
        p_guest_first_name: guest.firstName,
        p_guest_last_name: guest.lastName,
        p_drink_id: guest.drinkId || null
      });
      if (error) {
        console.error("Failed to book pass via RPC:", error);
        alert("Erreur de réservation: " + error.message);
      }
    }
  },

  async getUserPasses(userId: string): Promise<Pass[]> {
    const supabase = createClient();
    
    // First, fetch the passes with their events
    const { data: passes, error } = await supabase
      .from('passes')
      .select('*, events(title, date, location)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error || !passes) {
      console.error("Error fetching passes:", error);
      return [];
    }

    // Map drink menus directly since drink_id is on passes
    if (passes.length > 0) {
      const menuIds = [...new Set(passes.map((p: any) => p.drink_id).filter(Boolean))];
      if (menuIds.length > 0) {
        const { data: menus } = await supabase
          .from('drink_menus')
          .select('*')
          .in('id', menuIds);
        
        if (menus) {
          const menusMap: Record<string, any> = {};
          menus.forEach((m: any) => menusMap[m.id] = m);
          
          passes.forEach((pass: any) => {
            if (pass.drink_id && menusMap[pass.drink_id]) {
              pass.drink_menus = menusMap[pass.drink_id];
            }
          });
        }
      }
    }
    return passes as Pass[];
  },

  // --- ADMIN (Phase 2 & 3) ---
  async getPendingPasses(): Promise<Pass[]> {
    const supabase = createClient();
    const { data } = await supabase.from('passes').select('*').eq('entry_status', 'pending');
    return data || [];
  },

  async getAllPasses(): Promise<Pass[]> {
    const supabase = createClient();
    
    // Fetch all passes
    const { data: passesData } = await supabase.from('passes').select('*');
    if (!passesData) return [];
    
    // Fetch all profiles to map instagram handles manually
    const { data: profilesData } = await supabase.from('profiles').select('id, instagram_handle');
    
    return passesData.map((pass: any) => {
      const profile = profilesData?.find((p: any) => p.id === pass.user_id);
      return {
        ...pass,
        instagram_handle: profile?.instagram_handle || '@unknown'
      };
    });
  },

  async approvePass(passId: string): Promise<void> {
    const res = await fetch('/api/admin/passes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, action: 'approve' }),
    });
    if (!res.ok) throw new Error("Failed to approve pass");
  },

  async markPassPaid(passId: string): Promise<void> {
    const res = await fetch('/api/admin/passes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, action: 'mark_paid' }),
    });
    if (!res.ok) throw new Error("Failed to activate pass");
  },

  async deletePass(passId: string): Promise<void> {
    const res = await fetch('/api/admin/passes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, action: 'reject' }),
    });
    if (!res.ok) throw new Error("Failed to delete pass");
  },

  // --- SCANNER (Phase 5) ---
  async scanPass(qrUuid: string): Promise<{ success: boolean, message: string }> {
    const supabase = createClient();
    
    const { data: pass, error } = await supabase
      .from('passes')
      .select('*')
      .eq('entry_qr_uuid', qrUuid)
      .single();
      
    if (error || !pass) return { success: false, message: "DENIED: Invalid QR Code" };
    if (pass.entry_status === 'scanned') return { success: false, message: "DENIED: Pass Already Used!" };
    if (pass.entry_status !== 'activated') return { success: false, message: "DENIED: Pass Not Activated" };

    const { error: updateError } = await supabase
      .from('passes')
      .update({ entry_status: 'scanned' })
      .eq('id', pass.id);

    if (updateError) return { success: false, message: "DENIED: Database Error" };

    return { success: true, message: "SUCCESS: Pass Validated!" };
  },

  // --- MISSING ADMIN FEATURES (Events, Staff) ---
  async createEvent(title: string, date: string, location: string, pre_orders_enabled: boolean, max_passes_per_user: number, image_url: string, drinks?: {name: string}[]): Promise<void> {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, location, pre_orders_enabled, max_passes_per_user, image_url, drinks }),
    });
    if (!res.ok) throw new Error("Failed to create event");
  },

  async updateEvent(id: string, title: string, date: string, location: string, pre_orders_enabled: boolean, max_passes_per_user: number, image_url: string, drinks?: {name: string}[]): Promise<void> {
    const res = await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, date, location, pre_orders_enabled, max_passes_per_user, image_url, drinks }),
    });
    if (!res.ok) throw new Error("Failed to update event");
  },

  async deleteEvent(eventId: string): Promise<void> {
    const res = await fetch(`/api/admin/events?eventId=${eventId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error("Failed to delete event");
  },

  async getProfiles(): Promise<User[]> {
    const supabase = createClient();
    const { data } = await supabase.from('profiles').select('*');
    return data || [];
  },

  async updateRole(userId: string, role: string): Promise<void> {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error);
    }
  },

  async adminUpdateUser(userId: string, email?: string, password?: string, instagramHandle?: string, role?: string): Promise<void> {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, password, instagramHandle, role }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`/api/admin/users?userId=${userId}`, {
      method: 'DELETE',
    });
    
    if (!res.ok) {
      const { error } = await res.json();
      console.error("Error deleting user:", error);
      throw new Error(error);
    }
  },

  async adminCreateUser(email: string, password: string, instagramHandle: string, role: string): Promise<void> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, instagramHandle, role }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      console.error("Error creating user:", error);
      throw new Error(error);
    }
  },

  async getStats(): Promise<{ totalUsers: number, totalEvents: number, totalPasses: number, revenue: number, chartData: number[] }> {
    const supabase = createClient();
    const [{ count: userCount }, { count: eventCount }, { data: passes }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('passes').select('entry_status, created_at')
    ]);
    
    // Revenue calculation
    const paidPasses = passes?.filter((p: any) => p.entry_status === 'activated' || p.entry_status === 'scanned').length || 0;
    const revenue = paidPasses * 20;

    // Calculate real chart data for the last 7 days
    const chartData = [0, 0, 0, 0, 0, 0, 0];
    if (passes) {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      passes.forEach((p: any) => {
        const passDate = new Date(p.created_at);
        passDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - passDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
          // diffDays 0 is today (last element), 6 is 7 days ago (first element)
          chartData[6 - diffDays]++;
        }
      });
    }

    return {
      totalUsers: userCount || 0,
      totalEvents: eventCount || 0,
      totalPasses: passes?.length || 0,
      revenue,
      chartData
    };
  }
};
