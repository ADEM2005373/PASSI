import { createClient } from '../supabase/client';
import { getURL, formatImageUrl } from '../utils/url';

export type User = {
  id: string;
  email: string;
  instagram_handle: string;
  role: 'admin' | 'user' | 'security' | 'barman' | 'payment_point' | 'PAYMENT_POINT' | string;
  is_suspended?: boolean;
  original_role?: string;
  full_name?: string;
  created_at?: string;
};

export type PromoCode = {
  code: string;
  discount_amount: number;
};

export type Event = {
  id: string;
  title: string;
  date: string;
  location: string;
  pre_orders_enabled: boolean;
  max_passes_per_user: number;
  base_price?: number;
  promo_codes?: PromoCode[];
  image_url?: string;
  description?: string;
  dress_code?: string;
  drink_menus?: { id: string, name: string }[];
};

export type Pass = {
  id: string;
  user_id: string;
  event_id: string;
  guest_first_name: string;
  guest_last_name: string;
  entry_qr_uuid: string | null;
  entry_status: 'pending' | 'awaiting_payment' | 'activated' | 'scanned' | 'rejected';
  rejection_reason?: string | null;
  final_price?: number;
  promo_used?: string | null;
  payment_point_id?: string | null;
  payment_approved_at?: string | null;
  updated_at?: string;
  instagram_handle?: string;
  drink_menus?: { id?: string; name: string; price?: number; image_url?: string } | null;
  events?: { id?: string; title: string; base_price?: number; date?: string; location?: string } | null;
  // Special Pass Types (NORMAL, GIFT, INVITATION, VIP) & Asynchronous Drinks
  pass_type?: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP';
  invitation_status?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  drink_id?: string | null;
  drink_qr_code?: string | null;
  drink_qr_uuid?: string | null;
  drink_status?: string | null;
  available_drinks?: { id: string; name: string; price?: number; image_url?: string }[];
};

export type NewsItem = {
  id: string;
  title: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  admin_id: string;
  admin_profile?: {
    email?: string;
    full_name?: string;
  } | null;
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
        redirectTo: redirectTo ?? `${getURL()}/auth/callback`,
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

    let userProfile = profile as User;
    const actualRole = (userProfile.role || '').toUpperCase();
    if (actualRole === 'ADMIN' && typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )passi_impersonate_role=([^;]*)/);
      if (match) {
        const override = match[1].toLowerCase();
        if (['admin', 'user', 'barman', 'security', 'payment_point'].includes(override)) {
          userProfile = {
            ...userProfile,
            role: override as any,
            original_role: (userProfile.original_role || userProfile.role || 'admin').toLowerCase(),
            instagram_handle: userProfile.instagram_handle || '@admin_simulated',
          };
        }
      }
    }

    return userProfile;
  },

  async logout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  // --- EVENTS ---
  async getEvents(): Promise<Event[]> {
    const supabase = createClient();
    const { data: events, error } = await supabase
      .from('events')
      .select('*, drink_menus(*)')
      .order('date', { ascending: true });

    if (!error && events) {
      return events as Event[];
    }

    // Fallback if relation embedding fails
    const { data: fallbackEvents } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (!fallbackEvents || fallbackEvents.length === 0) return [];

    const eventIds = fallbackEvents.map((e: any) => e.id);
    const { data: allDrinks } = await supabase
      .from('drink_menus')
      .select('*')
      .in('event_id', eventIds);

    const drinksByEvent: Record<string, any[]> = {};
    (allDrinks || []).forEach((d: any) => {
      if (!drinksByEvent[d.event_id]) drinksByEvent[d.event_id] = [];
      drinksByEvent[d.event_id].push(d);
    });

    return fallbackEvents.map((e: any) => ({
      ...e,
      drink_menus: drinksByEvent[e.id] || []
    })) as Event[];
  },

  async getEvent(id: string): Promise<Event | undefined> {
    const supabase = createClient();
    const { data } = await supabase.from('events').select('*, drink_menus(*)').eq('id', id).single();
    if (!data) return undefined;
    
    // Safely attempt to fetch drinks if not returned by relation
    if (!data.drink_menus) {
      const { data: drinks } = await supabase.from('drink_menus').select('*').eq('event_id', id);
      return {
        ...data,
        drink_menus: drinks || []
      } as Event;
    }
    
    return data as Event;
  },

  // --- BOOKING (Phase 1) ---
  async bookPasses(
    eventId: string, 
    userId: string, 
    guests: { firstName: string, lastName: string, drinkId?: string }[],
    promoCode?: string
  ): Promise<void> {
    const supabase = createClient();
    
    for (const guest of guests) {
      const { data, error } = await supabase.rpc('create_pass_with_pricing', {
        p_user_id: userId,
        p_event_id: eventId,
        p_guest_first_name: guest.firstName,
        p_guest_last_name: guest.lastName,
        p_drink_id: guest.drinkId || null,
        p_promo_code: promoCode ? promoCode.trim() : null
      });

      if (error) {
        console.warn("create_pass_with_pricing RPC failed, falling back to create_pass:", error);
        // Fallback to legacy create_pass RPC if migration not yet applied
        const { error: fallbackError } = await supabase.rpc('create_pass', {
          p_user_id: userId,
          p_event_id: eventId,
          p_guest_first_name: guest.firstName,
          p_guest_last_name: guest.lastName,
          p_drink_id: guest.drinkId || null
        });
        if (fallbackError) {
          console.error("Failed to book pass via RPC:", fallbackError);
          alert("Erreur de réservation: " + fallbackError.message);
        }
      }
    }
  },

  async getUserPasses(userId: string): Promise<Pass[]> {
    const supabase = createClient();
    
    // First, fetch the passes with their events
    const { data: passes, error } = await supabase
      .from('passes')
      .select('*, events(id, title, date, location)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    let activePasses = passes || [];

    // Fallback for admin simulation: if an admin simulating a user has no personal passes,
    // load available passes so the simulator user interface and mock actions can be tested
    const match = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )passi_impersonate_role=([^;]*)/) : null;
    const isSimulating = Boolean(match && match[1]);

    if (isSimulating && activePasses.length === 0) {
      const { data: samplePasses } = await supabase
        .from('passes')
        .select('*, events(id, title, date, location)')
        .limit(10)
        .order('created_at', { ascending: false });
      if (samplePasses && samplePasses.length > 0) {
        activePasses = samplePasses;
      }
    }
      
    if (error && activePasses.length === 0) {
      console.error("Error fetching passes:", error);
      return [];
    }

    // 48-Hour Retention Filter (Soft-hide rejected passes older than 48 hours)
    const now = Date.now();
    const validPasses = activePasses.filter((p: any) => {
      if (p.entry_status === 'rejected') {
        const updatedAt = new Date(p.updated_at || p.created_at).getTime();
        return (now - updatedAt) <= (48 * 60 * 60 * 1000);
      }
      return true;
    });

    if (validPasses.length > 0) {
      const menuIds = [...new Set(validPasses.map((p: any) => p.drink_id).filter(Boolean))];
      const eventIds = [...new Set(validPasses.map((p: any) => p.event_id).filter(Boolean))];

      const [menusRes, eventDrinksRes] = await Promise.all([
        menuIds.length > 0
          ? supabase.from('drink_menus').select('*').in('id', menuIds)
          : Promise.resolve({ data: [] }),
        eventIds.length > 0
          ? supabase.from('drink_menus').select('*').in('event_id', eventIds)
          : Promise.resolve({ data: [] })
      ]);

      const menusMap: Record<string, any> = {};
      (menusRes.data || []).forEach((m: any) => menusMap[m.id] = m);

      const drinksByEvent: Record<string, any[]> = {};
      (eventDrinksRes.data || []).forEach((d: any) => {
        if (!drinksByEvent[d.event_id]) drinksByEvent[d.event_id] = [];
        drinksByEvent[d.event_id].push(d);
      });

      validPasses.forEach((pass: any) => {
        if (pass.drink_id && menusMap[pass.drink_id]) {
          pass.drink_menus = menusMap[pass.drink_id];
        }
        pass.available_drinks = drinksByEvent[pass.event_id] || [];
      });
    }
    return validPasses as Pass[];
  },

  // --- ADMIN (Phase 2 & 3) ---
  async getPendingPasses(): Promise<Pass[]> {
    const supabase = createClient();
    const { data } = await supabase.from('passes').select('*').in('entry_status', ['pending', 'awaiting_payment']);
    return data || [];
  },

  async getAllPasses(): Promise<Pass[]> {
    const supabase = createClient();
    
    // Fetch all passes
    const { data: passesData } = await supabase.from('passes').select('*, drink_menus(name), events(title)');
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

  async rejectPass(passId: string, reason?: string): Promise<void> {
    const res = await fetch('/api/admin/passes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, action: 'reject', rejectionReason: reason }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to reject pass");
    }
  },

  async deletePass(passId: string, holderNameConfirmation: string): Promise<void> {
    const res = await fetch('/api/admin/passes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, holderNameConfirmation }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Impossible de supprimer le pass");
    }
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
  async createEvent(
    title: string, 
    date: string, 
    location: string, 
    pre_orders_enabled: boolean, 
    max_passes_per_user: number, 
    image_url: string, 
    description?: string, 
    dress_code?: string, 
    drinks?: { id?: string; name: string }[],
    base_price?: number,
    promo_codes?: PromoCode[]
  ): Promise<void> {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        date, 
        location, 
        pre_orders_enabled, 
        max_passes_per_user, 
        image_url: formatImageUrl(image_url), 
        description, 
        dress_code, 
        drinks,
        base_price: base_price ?? 0,
        promo_codes: promo_codes ?? []
      }),
    });
    if (!res.ok) throw new Error("Failed to create event");
  },

  async updateEvent(
    id: string, 
    title: string, 
    date: string, 
    location: string, 
    pre_orders_enabled: boolean, 
    max_passes_per_user: number, 
    image_url: string, 
    description?: string, 
    dress_code?: string, 
    drinks?: { id?: string; name: string }[],
    base_price?: number,
    promo_codes?: PromoCode[]
  ): Promise<void> {
    const res = await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id, 
        title, 
        date, 
        location, 
        pre_orders_enabled, 
        max_passes_per_user, 
        image_url: formatImageUrl(image_url), 
        description, 
        dress_code, 
        drinks,
        base_price: base_price ?? 0,
        promo_codes: promo_codes ?? []
      }),
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

  async createStaffAccount(payload: { email: string; password: string; role: string; fullName?: string; instagramHandle?: string }): Promise<{ success: boolean; userId?: string }> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        role: payload.role,
        instagramHandle: payload.instagramHandle,
        fullName: payload.fullName,
      }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Failed to create staff account');
    }

    const data = await res.json();
    return { success: true, userId: data.userId };
  },

  async toggleUserSuspension(userId: string, is_suspended: boolean): Promise<void> {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_suspended }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Failed to update suspension status');
    }
  },

  async getPaymentPointPasses(eventId?: string): Promise<Pass[]> {
    const supabase = createClient();
    let query = supabase
      .from('passes')
      .select('*, events(title, base_price), drink_menus(name)')
      .in('entry_status', ['awaiting_payment', 'pending'])
      .order('created_at', { ascending: false });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data: passesData, error } = await query;
    if (error || !passesData) return [];

    // Fetch user profiles to display user identity
    const userIds = Array.from(new Set(passesData.map((p: any) => p.user_id).filter(Boolean)));
    let profilesMap: Record<string, { email?: string; instagram_handle?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, instagram_handle')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((pr: any) => {
          profilesMap[pr.id] = pr;
        });
      }
    }

    return passesData.map((pass: any) => {
      const userProf = profilesMap[pass.user_id];
      return {
        ...pass,
        instagram_handle: userProf?.instagram_handle || '@inconnu',
        user_email: userProf?.email || '',
      };
    });
  },

  async approvePaymentPointPass(passId: string): Promise<void> {
    const res = await fetch('/api/payment-point/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Impossible de valider le paiement');
    }
  },

  async getPaymentPointFinancialStats(options?: { eventId?: string; date?: string }): Promise<{
    workers: Array<{
      id: string;
      email: string;
      totalPasses: number;
      totalCollected: number;
      passes: Array<{
        id: string;
        eventTitle: string;
        finalPrice: number;
        approvedAt: string;
        userEmail?: string;
        instagramHandle?: string;
      }>;
    }>;
    dailyBreakdown: Array<{
      date: string;
      totalPasses: number;
      totalCollected: number;
    }>;
    overallTotalPasses: number;
    overallTotalCollected: number;
  }> {
    const supabase = createClient();
    let query = supabase
      .from('passes')
      .select('id, event_id, user_id, final_price, payment_point_id, payment_approved_at, events(title)')
      .not('payment_point_id', 'is', null)
      .in('entry_status', ['activated', 'scanned', 'PAID', 'paid'])
      .order('payment_approved_at', { ascending: false });

    if (options?.eventId) {
      query = query.eq('event_id', options.eventId);
    }

    const { data: passesData, error } = await query;
    if (error || !passesData) {
      return { workers: [], dailyBreakdown: [], overallTotalPasses: 0, overallTotalCollected: 0 };
    }

    // Filter by date if specified (YYYY-MM-DD)
    const filteredPasses = options?.date
      ? passesData.filter((p: any) => p.payment_approved_at && p.payment_approved_at.startsWith(options.date!))
      : passesData;

    // Get profiles for workers and pass owners
    const { data: allProfiles } = await supabase.from('profiles').select('id, email, instagram_handle, role');
    const profilesMap = new Map<string, any>((allProfiles || []).map((p: any) => [p.id, p]));

    const workerMap = new Map<string, {
      id: string;
      email: string;
      totalPasses: number;
      totalCollected: number;
      passes: Array<{
        id: string;
        eventTitle: string;
        finalPrice: number;
        approvedAt: string;
        userEmail?: string;
        instagramHandle?: string;
      }>;
    }>();

    const dailyMap = new Map<string, { date: string; totalPasses: number; totalCollected: number }>();
    let overallTotalPasses = 0;
    let overallTotalCollected = 0;

    for (const pass of filteredPasses) {
      const workerId = pass.payment_point_id;
      const workerProfile = profilesMap.get(workerId);
      const workerEmail = workerProfile?.email || `Worker ${workerId.slice(0, 6)}`;
      const price = Number(pass.final_price) || 0;
      const passOwner = profilesMap.get(pass.user_id);

      overallTotalPasses += 1;
      overallTotalCollected += price;

      // Worker grouping
      if (!workerMap.has(workerId)) {
        workerMap.set(workerId, {
          id: workerId,
          email: workerEmail,
          totalPasses: 0,
          totalCollected: 0,
          passes: [],
        });
      }
      const workerEntry = workerMap.get(workerId)!;
      workerEntry.totalPasses += 1;
      workerEntry.totalCollected += price;
      workerEntry.passes.push({
        id: pass.id,
        eventTitle: pass.events?.title || 'Événement',
        finalPrice: price,
        approvedAt: pass.payment_approved_at || '',
        userEmail: passOwner?.email || '',
        instagramHandle: passOwner?.instagram_handle || '',
      });

      // Daily breakdown
      if (pass.payment_approved_at) {
        const day = pass.payment_approved_at.split('T')[0];
        if (!dailyMap.has(day)) {
          dailyMap.set(day, { date: day, totalPasses: 0, totalCollected: 0 });
        }
        const dailyEntry = dailyMap.get(day)!;
        dailyEntry.totalPasses += 1;
        dailyEntry.totalCollected += price;
      }
    }

    return {
      workers: Array.from(workerMap.values()),
      dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
      overallTotalPasses,
      overallTotalCollected,
    };
  },

  async getStats(): Promise<{ totalUsers: number, totalEvents: number, totalPasses: number, revenue: number, chartData: number[] }> {
    const supabase = createClient();
    const [{ count: userCount }, { count: eventCount }, { data: passes }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('passes').select('entry_status, created_at, final_price')
    ]);
    
    // Active passes (activated or scanned) & Revenue calculation
    const activePasses = passes?.filter((p: any) => p.entry_status === 'activated' || p.entry_status === 'scanned') || [];
    const revenue = activePasses.reduce((acc: number, p: any) => acc + (Number(p.final_price) || 0), 0);

    // Calculate real chart data for the last 7 days (active passes only)
    const chartData = [0, 0, 0, 0, 0, 0, 0];
    if (activePasses.length > 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      activePasses.forEach((p: any) => {
        const passDate = new Date(p.created_at);
        passDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - passDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
          chartData[6 - diffDays]++;
        }
      });
    }

    return {
      totalUsers: userCount || 0,
      totalEvents: eventCount || 0,
      totalPasses: activePasses.length,
      revenue,
      chartData
    };
  },

  // --- MANUAL PASS CREATION (Admin) ---
  async createManualPass(data: {
    userId: string;
    eventId: string;
    passType: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP';
    guestFirstName?: string;
    guestLastName?: string;
  }): Promise<{ success: boolean; pass: Pass; message?: string }> {
    const res = await fetch('/api/admin/passes/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur lors de la création du pass');
    return result;
  },

  // --- INVITATION FLOW (User) ---
  async respondToInvitation(passId: string, action: 'accept' | 'decline'): Promise<{ success: boolean; pass: Pass; message?: string }> {
    const res = await fetch('/api/passes/invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, action }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur lors du traitement de l\'invitation');
    return result;
  },

  // --- ASYNCHRONOUS DRINK SELECTION (User) ---
  async selectPassDrink(passId: string, drinkId: string): Promise<{ success: boolean; pass: Pass; drink?: any; message?: string }> {
    const res = await fetch('/api/passes/select-drink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, drinkId }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur lors de la sélection de la boisson');
    return result;
  },

  // --- NEWS FEED (Actualités) ---
  async getNews(): Promise<NewsItem[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('news')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false });

    if (error || !data) {
      // Fallback query if relation join is not populated
      const { data: fallbackNews } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      return (fallbackNews || []) as NewsItem[];
    }

    return data.map((item: any) => ({
      ...item,
      admin_profile: item.profiles || null
    })) as NewsItem[];
  },

  async createNews(title: string, content: string, imageUrl?: string): Promise<NewsItem> {
    const res = await fetch('/api/admin/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        imageUrl: formatImageUrl(imageUrl),
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erreur lors de la publication de l'actualité");
    return result.news;
  },

  async deleteNews(newsId: string): Promise<void> {
    const res = await fetch(`/api/admin/news?newsId=${newsId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw new Error(result.error || "Impossible de supprimer l'actualité");
    }
  }
};

