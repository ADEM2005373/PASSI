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

export type DrinkItem = {
  id?: string;
  name: string;
  price?: number;
  aromas?: string[];
  image_url?: string;
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
  drinks?: DrinkItem[];
  drink_menus?: DrinkItem[];
};

export type Pass = {
  id: string;
  user_id: string;
  event_id: string;
  guest_first_name: string;
  guest_last_name: string;
  entry_qr_uuid: string | null;
  entry_status: 'pending' | 'awaiting_payment' | 'activated' | 'scanned' | 'rejected';
  status?: string;
  rejection_reason?: string | null;
  final_price?: number;
  promo_used?: string | null;
  payment_point_id?: string | null;
  approved_by?: string | null;
  payment_approved_at?: string | null;
  created_by?: string | null;
  pass_origin?: 'USER' | 'ADMIN' | string | null;
  creator?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  owner?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    instagram?: string | null;
    instagram_handle?: string | null;
    role?: string | null;
  } | null;
  approver?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  updated_at?: string;
  instagram_handle?: string;
  drink_menus?: { id?: string; name: string; price?: number; image_url?: string; aromas?: string[] } | null;
  events?: { id?: string; title: string; base_price?: number; date?: string; location?: string } | null;
  // Special Pass Types (NORMAL, GIFT, INVITATION, VIP) & Asynchronous Drinks
  pass_type?: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP';
  invitation_status?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  drink_name?: string | null;
  drink_id?: string | null;
  selected_aromas?: string[] | null;
  drink_qr_code?: string | null;
  drink_qr_uuid?: string | null;
  drink_status?: string | null;
  available_drinks?: DrinkItem[];
  user?: { first_name?: string; last_name?: string; full_name?: string };
  user_name?: string;
  user_email?: string;
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

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("Profil manquant pour l'utilisateur connecté, tentative d'auto-création...");
      const meta = user.user_metadata || {};
      const inferredRole = (meta.role || (user.email?.includes('passi.com') ? 'admin' : 'user')).toLowerCase();
      const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'Utilisateur');

      try {
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email || '',
            full_name: fullName,
            first_name: meta.first_name || fullName.split(' ')[0] || '',
            last_name: meta.last_name || fullName.split(' ').slice(1).join(' ') || '',
            role: inferredRole as any,
            is_suspended: false,
          }, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        if (newProfile) {
          profile = newProfile;
        }
      } catch (e) {
        console.warn("Client profile upsert failed, using safe fallback:", e);
      }

      if (!profile) {
        profile = {
          id: user.id,
          email: user.email || '',
          full_name: fullName,
          first_name: meta.first_name || fullName.split(' ')[0] || '',
          last_name: meta.last_name || fullName.split(' ').slice(1).join(' ') || '',
          role: inferredRole as any,
          instagram_handle: meta.instagram_handle || null,
          is_suspended: false,
          created_at: user.created_at,
        };
      }
    }

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
    guests: { firstName: string, lastName: string, drinkName?: string, drinkId?: string, selectedAromas?: string[] }[],
    promoCode?: string
  ): Promise<void> {
    const supabase = createClient();
    
    for (const guest of guests) {
      const drinkName = (guest.drinkName || guest.drinkId || '').trim() || null;

      // 1. Primary RPC: create_pass_with_pricing using p_drink_name (TEXT) and p_selected_aromas
      const { data, error } = await supabase.rpc('create_pass_with_pricing', {
        p_user_id: userId,
        p_event_id: eventId,
        p_guest_first_name: guest.firstName,
        p_guest_last_name: guest.lastName,
        p_drink_name: drinkName,
        p_promo_code: promoCode ? promoCode.trim() : null,
        p_selected_aromas: Array.isArray(guest.selectedAromas) ? guest.selectedAromas : []
      });

      if (error) {
        console.warn("create_pass_with_pricing RPC with p_drink_name and aromas failed, trying fallback:", error);
        
        // 2. Fallback: try create_pass_with_pricing without p_selected_aromas
        const { error: retryError } = await supabase.rpc('create_pass_with_pricing', {
          p_user_id: userId,
          p_event_id: eventId,
          p_guest_first_name: guest.firstName,
          p_guest_last_name: guest.lastName,
          p_drink_name: drinkName,
          p_promo_code: promoCode ? promoCode.trim() : null
        });

        if (retryError) {
          // 3. Fallback: legacy create_pass RPC with p_drink_name
          const { error: fallbackError } = await supabase.rpc('create_pass', {
            p_user_id: userId,
            p_event_id: eventId,
            p_guest_first_name: guest.firstName,
            p_guest_last_name: guest.lastName,
            p_drink_name: drinkName
          });

          if (fallbackError) {
            // 4. Fallback: direct insert to passes table
            const { error: directInsertError } = await supabase.from('passes').insert({
              user_id: userId,
              event_id: eventId,
              guest_first_name: guest.firstName,
              guest_last_name: guest.lastName,
              drink_name: drinkName,
              selected_aromas: Array.isArray(guest.selectedAromas) ? guest.selectedAromas : [],
              entry_status: 'pending'
            });

            if (directInsertError) {
              console.error("Failed to book pass via all methods:", directInsertError);
              alert("Erreur de réservation: " + (directInsertError.message || fallbackError.message));
            }
          }
        }
      }
    }
  },

  async getUserPasses(userId: string): Promise<Pass[]> {
    const supabase = createClient();
    
    // First, fetch the passes with their events (including drinks JSONB)
    const { data: passes, error } = await supabase
      .from('passes')
      .select('*, events(id, title, date, location, drinks)')
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
        .select('*, events(id, title, date, location, drinks)')
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
        if (pass.drink_name) {
          pass.drink_menus = { name: pass.drink_name };
        } else if (pass.drink_id && menusMap[pass.drink_id]) {
          pass.drink_menus = menusMap[pass.drink_id];
        }

        const rawEventDrinks = pass.events?.drinks;
        let eventDrinks: any[] = [];
        if (Array.isArray(rawEventDrinks)) {
          eventDrinks = rawEventDrinks;
        } else if (typeof rawEventDrinks === 'string') {
          try {
            eventDrinks = JSON.parse(rawEventDrinks);
          } catch {
            eventDrinks = [];
          }
        }

        if (eventDrinks.length > 0) {
          pass.available_drinks = eventDrinks;
        } else {
          pass.available_drinks = drinksByEvent[pass.event_id] || [];
        }
      });
    }
    return validPasses as Pass[];
  },

  // --- ADMIN (Phase 2 & 3) ---
  async getPendingPasses(eventId?: string): Promise<Pass[]> {
    // 1. Try server endpoint with service role (no caching)
    try {
      const url = '/api/admin/passes?status=pending' + (eventId && eventId !== 'all' ? `&eventId=${eventId}` : '');
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.passes)) {
          return json.passes;
        }
      }
    } catch (e) {
      console.warn("GET /api/admin/passes?status=pending failed, falling back to direct query:", e);
    }

    // 2. Direct Supabase query as requested
    const supabase = createClient();
    let query = supabase
      .from('passes')
      .select('*, event:events(*), user:profiles!passes_user_id_fkey(*)')
      .order('created_at', { ascending: false });

    query = query.or('entry_status.eq.pending,entry_status.eq.PENDING');

    if (eventId && eventId !== 'all' && eventId.trim() !== '') {
      query = query.eq('event_id', eventId);
    }

    let { data: passesData, error } = await query;

    // Fallback if foreign key alias fails
    if (error || !passesData) {
      let fallbackQuery = supabase
        .from('passes')
        .select('*, events(*)')
        .order('created_at', { ascending: false });

      fallbackQuery = fallbackQuery.or('entry_status.eq.pending,entry_status.eq.PENDING');
      if (eventId && eventId !== 'all' && eventId.trim() !== '') {
        fallbackQuery = fallbackQuery.eq('event_id', eventId);
      }
      const fallbackRes = await fallbackQuery;
      passesData = fallbackRes.data;
    }

    if (!passesData) {
      const plainQuery = supabase
        .from('passes')
        .select('*')
        .or('entry_status.eq.pending,entry_status.eq.PENDING')
        .order('created_at', { ascending: false });
      const plainRes = await plainQuery;
      passesData = plainRes.data || [];
    }

    // Map profiles and relations
    const { data: profilesData } = await supabase.from('profiles').select('id, instagram_handle, full_name, email');
    const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

    return passesData.map((pass: any) => {
      const profile = profilesMap.get(pass.user_id) || pass.user || pass.profiles;
      const evt = pass.event || pass.events;
      let resolvedInstagram = '';
      if (profile?.instagram_handle && profile.instagram_handle.trim() !== '') {
        resolvedInstagram = profile.instagram_handle.trim();
      } else if (pass.instagram_handle && pass.instagram_handle.trim() !== '' && pass.instagram_handle !== '@unknown') {
        resolvedInstagram = pass.instagram_handle.trim();
      } else if (profile?.email) {
        resolvedInstagram = `(${profile.email})`;
      } else if (profile?.full_name) {
        resolvedInstagram = `@${profile.full_name.toLowerCase().replace(/\s+/g, '.')}`;
      }

      return {
        ...pass,
        event: evt,
        events: evt,
        user: profile,
        profiles: profile,
        status: pass.entry_status || pass.status,
        entry_status: pass.entry_status || pass.status,
        instagram_handle: resolvedInstagram,
        drink_menus: pass.drink_name ? { name: pass.drink_name } : (pass.drink_menus || null),
      };
    });
  },

  async getAllPasses(eventId?: string): Promise<Pass[]> {
    // 1. Try server endpoint with service role (no caching)
    try {
      const url = '/api/admin/passes' + (eventId && eventId !== 'all' ? `?eventId=${eventId}` : '');
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.passes)) {
          return json.passes;
        }
      }
    } catch (e) {
      console.warn("GET /api/admin/passes failed, falling back to direct query:", e);
    }

    // 2. Direct Supabase query
    const supabase = createClient();
    let query = supabase
      .from('passes')
      .select(`
        *,
        event:events(*),
        creator:profiles!passes_created_by_fkey(id, email, full_name, role),
        approver:profiles!passes_approved_by_fkey(id, email, full_name, role)
      `)
      .order('created_at', { ascending: false });

    if (eventId && eventId !== 'all' && eventId.trim() !== '') {
      query = query.eq('event_id', eventId);
    }

    let { data: passesData, error } = await query;

    // Fallback if foreign key alias fails
    if (error || !passesData) {
      let fallbackQuery = supabase
        .from('passes')
        .select('*, event:events(*)')
        .order('created_at', { ascending: false });
      if (eventId && eventId !== 'all' && eventId.trim() !== '') {
        fallbackQuery = fallbackQuery.eq('event_id', eventId);
      }
      const fallbackRes = await fallbackQuery;
      passesData = fallbackRes.data;

      if (!passesData) {
        let fallbackEventsOnly = supabase
          .from('passes')
          .select('*, events(*)')
          .order('created_at', { ascending: false });
        if (eventId && eventId !== 'all' && eventId.trim() !== '') {
          fallbackEventsOnly = fallbackEventsOnly.eq('event_id', eventId);
        }
        passesData = (await fallbackEventsOnly).data;
      }
    }

    if (!passesData) {
      const plainQuery = supabase
        .from('passes')
        .select('*')
        .order('created_at', { ascending: false });
      const plainRes = await plainQuery;
      passesData = plainRes.data || [];
    }

    // Map profiles and relations for users, creators, and approvers
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, instagram_handle, full_name, email, role');
    const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

    return passesData.map((pass: any) => {
      const profile = profilesMap.get(pass.user_id) || pass.user || pass.profiles;
      const creatorProfile = pass.creator || profilesMap.get(pass.created_by) || null;
      const approverProfile = pass.approver || profilesMap.get(pass.approved_by) || profilesMap.get(pass.payment_point_id) || null;
      const evt = pass.event || pass.events;

      // Infer origin: either stored in pass_origin, or inferred if created_by is present or pass_type is special
      const isManualAdmin = Boolean(
        pass.created_by ||
        pass.pass_origin === 'ADMIN' ||
        ['VIP', 'GIFT', 'INVITATION'].includes((pass.pass_type || '').toUpperCase())
      );
      const passOrigin = pass.pass_origin || (isManualAdmin ? 'ADMIN' : 'USER');

      const formattedCreator = creatorProfile ? {
        ...creatorProfile,
        first_name: creatorProfile.first_name || (creatorProfile.full_name ? creatorProfile.full_name.split(' ')[0] : (creatorProfile.email ? creatorProfile.email.split('@')[0] : '')),
        last_name: creatorProfile.last_name || (creatorProfile.full_name && creatorProfile.full_name.split(' ').length > 1 ? creatorProfile.full_name.split(' ').slice(1).join(' ') : ''),
      } : null;

      const formattedOwner = profile ? {
        ...profile,
        first_name: profile.first_name || (profile.full_name ? profile.full_name.split(' ')[0] : (pass.guest_first_name || '')),
        last_name: profile.last_name || (profile.full_name && profile.full_name.split(' ').length > 1 ? profile.full_name.split(' ').slice(1).join(' ') : (pass.guest_last_name || '')),
        instagram: profile.instagram_handle || '',
      } : null;

      let resolvedInstagram = '';
      if (profile?.instagram_handle && profile.instagram_handle.trim() !== '') {
        resolvedInstagram = profile.instagram_handle.trim();
      } else if (pass.instagram_handle && pass.instagram_handle.trim() !== '' && pass.instagram_handle !== '@unknown') {
        resolvedInstagram = pass.instagram_handle.trim();
      } else if (profile?.email) {
        resolvedInstagram = `(${profile.email})`;
      } else if (profile?.full_name) {
        resolvedInstagram = `@${profile.full_name.toLowerCase().replace(/\s+/g, '.')}`;
      }

      return {
        ...pass,
        pass_origin: passOrigin,
        event: evt,
        events: evt,
        user: profile,
        profiles: profile,
        owner: formattedOwner,
        creator: formattedCreator,
        approver: approverProfile,
        status: pass.entry_status || pass.status,
        entry_status: pass.entry_status || pass.status,
        instagram_handle: resolvedInstagram,
        drink_menus: pass.drink_name ? { name: pass.drink_name } : (pass.drink_menus || null),
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
    drinks?: { id?: string; name: string; aromas?: string[]; price?: number }[],
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
    drinks?: { id?: string; name: string; aromas?: string[]; price?: number }[],
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
    // CRITICAL FIX: Strictly filter passes for Payment Point.
    // Must only return passes pre-approved by admin ('awaiting_payment' / 'PENDING_PAYMENT').
    // Explicitly excludes 'pending' (waiting for admin), 'rejected', and 'activated'/'scanned' (already paid).
    let query = supabase
      .from('passes')
      .select('*, events(title, base_price)')
      .eq('entry_status', 'awaiting_payment')
      .order('created_at', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    let { data: passesData, error } = await query;

    // Schema compatibility fallback if column is named 'status' instead of 'entry_status'
    if (error && error.message?.includes('entry_status')) {
      let fallbackQuery = supabase
        .from('passes')
        .select('*, events(title, base_price)')
        .eq('status', 'PENDING_PAYMENT')
        .order('created_at', { ascending: true });

      if (eventId) {
        fallbackQuery = fallbackQuery.eq('event_id', eventId);
      }
      const fallbackRes = await fallbackQuery;
      passesData = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error || !passesData) return [];

    // Defensive check: explicitly exclude 'pending', 'rejected', 'activated', and 'scanned'
    const preApprovedPasses = passesData.filter((pass: any) => {
      const s = pass.entry_status || pass.status;
      return s === 'awaiting_payment' || s === 'PENDING_PAYMENT';
    });

    // Fetch user profiles to display user identity
    const userIds = Array.from(new Set(preApprovedPasses.map((p: any) => p.user_id).filter(Boolean)));
    let profilesMap: Record<string, { email?: string; instagram_handle?: string; full_name?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, instagram_handle, full_name')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((pr: any) => {
          profilesMap[pr.id] = pr;
        });
      }
    }

    return preApprovedPasses.map((pass: any) => {
      const userProf = profilesMap[pass.user_id];
      const guestFirst = pass.guest_first_name || '';
      const guestLast = pass.guest_last_name || '';
      const profileName = userProf?.full_name || '';
      const parts = profileName.trim().split(' ');
      return {
        ...pass,
        status: 'PENDING_PAYMENT',
        instagram_handle: userProf?.instagram_handle || '@inconnu',
        user_email: userProf?.email || '',
        user_name: profileName || [guestFirst, guestLast].filter(Boolean).join(' '),
        user: {
          first_name: guestFirst || parts[0] || '',
          last_name: guestLast || parts.slice(1).join(' ') || '',
          full_name: profileName || [guestFirst, guestLast].filter(Boolean).join(' ') || ''
        }
      };
    });
  },

  // Alias for getPaymentPointPasses matching standard naming convention
  async getPassesForPaymentPoint(eventId?: string): Promise<Pass[]> {
    return api.getPaymentPointPasses(eventId);
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
      .select('id, event_id, user_id, final_price, payment_point_id, approved_by, payment_approved_at, events(title)')
      .or('payment_point_id.not.is.null,approved_by.not.is.null')
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
    const { data: allProfiles } = await supabase.from('profiles').select('id, email, full_name, first_name, last_name, instagram_handle, role');
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
      const workerId = pass.approved_by || pass.payment_point_id;
      if (!workerId) continue;
      const workerProfile = profilesMap.get(workerId);
      const isSimulation = (workerProfile?.role || '').toLowerCase() === 'admin';
      const workerName = [workerProfile?.first_name, workerProfile?.last_name].filter(Boolean).join(' ') 
        || workerProfile?.full_name 
        || workerProfile?.email?.split('@')[0] 
        || `Guichet ${workerId.slice(0, 6)}`;
      const workerEmail = isSimulation 
        ? `${workerName} (Mode Simulation)` 
        : (workerProfile?.email || workerName);
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

  // ─── SYSTÈME CAISSIER (POS CASH MANAGEMENT) ───
  async getCashierPosData(): Promise<{
    liveDrawerBalance: number;
    todayRevenue: number;
    todayPassesCount: number;
    lastCollection: {
      id: string;
      supervisor_name: string;
      collected_amount: number;
      collection_time: string;
      notes?: string;
    } | null;
    todayPasses: Array<{
      id: string;
      guestName: string;
      eventTitle: string;
      price: number;
      approvedAt: string;
    }>;
    closuresHistory: Array<{
      id: string;
      closure_date: string;
      passes_approved_count: number;
      expected_amount: number;
      declared_amount: number;
      discrepancy: number;
      status: 'MATCHED' | 'DISCREPANCY_ALERT';
      notes?: string;
      created_at: string;
    }>;
    collectionsHistory: Array<{
      id: string;
      supervisor_name: string;
      collected_amount: number;
      collection_time: string;
      notes?: string;
    }>;
  }> {
    const res = await fetch('/api/payment-point/cash-management', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors du chargement des données de caisse');
    }
    return res.json();
  },

  async submitCashClosure(declared_amount: number, notes?: string): Promise<{
    success: boolean;
    closure: any;
    status: 'MATCHED' | 'DISCREPANCY_ALERT';
    discrepancy: number;
    expectedAmount: number;
    declaredAmount: number;
    message: string;
  }> {
    const res = await fetch('/api/payment-point/cash-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close', declared_amount, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error: any = new Error(data.error || 'Erreur lors de la clôture de caisse');
      error.requiresNotes = data.requiresNotes;
      error.discrepancy = data.discrepancy;
      error.expectedAmount = data.expectedAmount;
      error.declaredAmount = data.declaredAmount;
      throw error;
    }
    return data;
  },

  async submitSupervisorCollection(supervisor_name: string, collected_amount: number, notes?: string): Promise<{
    success: boolean;
    collection: any;
    message: string;
  }> {
    const res = await fetch('/api/payment-point/cash-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'collect', supervisor_name, collected_amount, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de la remise de fonds au superviseur');
    }
    return data;
  },

  async getAdminCashSupervision(): Promise<{
    success: boolean;
    discrepancyAlerts: Array<{
      id: string;
      cashier_id: string;
      closure_date: string;
      passes_approved_count: number;
      expected_amount: number;
      declared_amount: number;
      discrepancy: number;
      status: 'DISCREPANCY_ALERT';
      notes?: string;
      created_at: string;
      cashier?: { email: string; full_name?: string };
    }>;
    cashiersOverview: Array<{
      id: string;
      email: string;
      full_name: string;
      is_suspended: boolean;
      liveDrawerBalance: number;
      todayRevenue: number;
      todayPassesCount: number;
      lastCollection: {
        amount: number;
        supervisor_name: string;
        collection_time: string;
        notes?: string;
      } | null;
    }>;
    allClosures: any[];
    allCollections: any[];
    summary: {
      totalLiveBalance: number;
      totalTodayRevenue: number;
      totalTodayPasses: number;
      alertsCount: number;
      cashiersCount: number;
    };
  }> {
    const res = await fetch('/api/admin/cash-management', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors du chargement de la supervision de caisse');
    }
    return res.json();
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

  // --- FINANCIAL & PASS ANALYTICS (Admin) ---
  async getDashboardAnalytics(timeframeDays: number = 30): Promise<{
    dailyData: Array<{
      date: string;
      formattedDate: string;
      passCount: number;
      dailyRevenue: number;
      volumeDiff: number;
      revenueDiff: number;
      volumeTrend: string;
      revenueTrend: string;
    }>;
    totalRevenue: number;
    totalPasses: number;
    averageDailyRevenue: number;
    startDate: string;
    endDate: string;
  }> {
    const supabase = createClient();
    const { data: passesData } = await supabase
      .from('passes')
      .select('id, final_price, payment_approved_at, created_at, entry_status')
      .or('payment_approved_at.not.is.null,entry_status.in.(activated,scanned,PAID,paid)')
      .order('payment_approved_at', { ascending: true });

    const rawPasses = passesData || [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dailyMap = new Map<string, { passCount: number; dailyRevenue: number }>();
    const daysToInclude = Math.max(7, Math.min(365, timeframeDays));

    for (let i = daysToInclude - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { passCount: 0, dailyRevenue: 0 });
    }

    for (const pass of rawPasses) {
      const dateRaw = pass.payment_approved_at || pass.created_at;
      if (!dateRaw) continue;
      const dateStr = dateRaw.split('T')[0];
      const price = Math.max(0, Number(pass.final_price) || 0);

      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { passCount: 0, dailyRevenue: 0 });
      }
      const current = dailyMap.get(dateStr)!;
      current.passCount += 1;
      current.dailyRevenue += price;
    }

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const windowDates = sortedDates.slice(-daysToInclude);

    let totalRevenue = 0;
    let totalPasses = 0;

    const dailyData = windowDates.map((dateStr, index) => {
      const entry = dailyMap.get(dateStr) || { passCount: 0, dailyRevenue: 0 };
      totalRevenue += entry.dailyRevenue;
      totalPasses += entry.passCount;

      let volumeDiff = 0;
      let revenueDiff = 0;

      if (index > 0) {
        const prevDate = windowDates[index - 1];
        const prevEntry = dailyMap.get(prevDate) || { passCount: 0, dailyRevenue: 0 };
        volumeDiff = entry.passCount - prevEntry.passCount;
        revenueDiff = entry.dailyRevenue - prevEntry.dailyRevenue;
      }

      const volumeTrend = index === 0
        ? "0 passes"
        : volumeDiff > 0
          ? `+${volumeDiff} passes`
          : volumeDiff < 0
            ? `${volumeDiff} passes`
            : "0 passes";

      const revenueTrend = index === 0
        ? "0 TND"
        : revenueDiff > 0
          ? `+${revenueDiff.toFixed(2)} TND`
          : revenueDiff < 0
            ? `${revenueDiff.toFixed(2)} TND`
            : "0 TND";

      const dateObj = new Date(dateStr + "T00:00:00");
      const formattedDate = dateObj.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
      });

      return {
        date: dateStr,
        formattedDate,
        passCount: entry.passCount,
        dailyRevenue: Math.round(entry.dailyRevenue * 100) / 100,
        volumeDiff,
        revenueDiff: Math.round(revenueDiff * 100) / 100,
        volumeTrend,
        revenueTrend
      };
    });

    return {
      dailyData,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPasses,
      averageDailyRevenue: dailyData.length > 0 ? Math.round((totalRevenue / dailyData.length) * 100) / 100 : 0,
      startDate: windowDates[0] || '',
      endDate: windowDates[windowDates.length - 1] || ''
    };
  },

  async getPassesActivityAnalytics(timeframeDays: number = 30): Promise<{
    dailyData: Array<{
      date: string;
      formattedDate: string;
      totalPasses: number;
      validatedPasses: number;
      pendingPasses: number;
      volumeDiff: number;
      volumeTrend: string;
    }>;
    totalPasses: number;
    totalValidated: number;
    totalPending: number;
    averageDailyPasses: number;
    peakDay: {
      date: string;
      formattedDate: string;
      count: number;
    } | null;
    startDate: string;
    endDate: string;
  }> {
    try {
      const { getPassesActivityAnalytics: serverAction } = await import('@/lib/actions/analytics');
      return await serverAction(timeframeDays);
    } catch (e) {
      console.warn("Falling back to client query for passes activity analytics:", e);
      const supabase = createClient();
      const { data: passesData } = await supabase
        .from('passes')
        .select('id, created_at, payment_approved_at, entry_status')
        .order('created_at', { ascending: true });

      const rawPasses = passesData || [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const daysToInclude = Math.max(7, Math.min(365, timeframeDays));
      const dailyMap = new Map<string, { total: number; validated: number; pending: number }>();

      for (let i = daysToInclude - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyMap.set(dateStr, { total: 0, validated: 0, pending: 0 });
      }

      for (const pass of rawPasses) {
        if (!pass.created_at) continue;
        const dateStr = pass.created_at.split('T')[0];
        const status = (pass.entry_status || '').toLowerCase();
        const isValidated = Boolean(
          pass.payment_approved_at || ['activated', 'scanned', 'paid'].includes(status)
        );
        const isPending = ['pending', 'en attente'].includes(status) || (!isValidated && !['rejected', 'cancelled'].includes(status));

        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, { total: 0, validated: 0, pending: 0 });
        }
        const cur = dailyMap.get(dateStr)!;
        cur.total += 1;
        if (isValidated) cur.validated += 1;
        if (isPending) cur.pending += 1;
      }

      const sortedDates = Array.from(dailyMap.keys()).sort();
      const windowDates = sortedDates.slice(-daysToInclude);

      let totalPasses = 0;
      let totalValidated = 0;
      let totalPending = 0;
      let peakDay: { date: string; formattedDate: string; count: number } | null = null;

      const dailyData = windowDates.map((dateStr, index) => {
        const entry = dailyMap.get(dateStr) || { total: 0, validated: 0, pending: 0 };
        totalPasses += entry.total;
        totalValidated += entry.validated;
        totalPending += entry.pending;

        const dateObj = new Date(dateStr + "T00:00:00");
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short'
        });

        if (!peakDay || entry.total > peakDay.count) {
          if (entry.total > 0) {
            peakDay = { date: dateStr, formattedDate, count: entry.total };
          }
        }

        let volumeDiff = 0;
        if (index > 0) {
          const prevDate = windowDates[index - 1];
          const prevEntry = dailyMap.get(prevDate) || { total: 0, validated: 0, pending: 0 };
          volumeDiff = entry.total - prevEntry.total;
        }

        const volumeTrend = index === 0
          ? "0 passes"
          : volumeDiff > 0
            ? `+${volumeDiff} passes`
            : volumeDiff < 0
              ? `${volumeDiff} passes`
              : "0 passes";

        return {
          date: dateStr,
          formattedDate,
          totalPasses: entry.total,
          validatedPasses: entry.validated,
          pendingPasses: entry.pending,
          volumeDiff,
          volumeTrend
        };
      });

      return {
        dailyData,
        totalPasses,
        totalValidated,
        totalPending,
        averageDailyPasses: dailyData.length > 0 ? Math.round((totalPasses / dailyData.length) * 10) / 10 : 0,
        peakDay,
        startDate: windowDates[0] || '',
        endDate: windowDates[windowDates.length - 1] || ''
      };
    }
  },

  // --- MANUAL PASS CREATION (Admin) ---
  async createManualPass(data: {
    userId: string;
    eventId: string;
    passType: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP' | 'CADEAU';
    guestFirstName?: string;
    guestLastName?: string;
    drink_name?: string;
    drinkName?: string;
    selected_aromas?: string[];
    selectedAromas?: string[];
    promo_code?: string;
    promoCode?: string;
    promo_used?: string;
    final_price?: number;
    finalPrice?: number;
  }): Promise<{ success: boolean; pass: Pass; message?: string }> {
    const payload = {
      ...data,
      drink_name: data.drink_name || data.drinkName,
      drinkName: data.drinkName || data.drink_name,
      selected_aromas: data.selected_aromas || data.selectedAromas || [],
      selectedAromas: data.selectedAromas || data.selected_aromas || [],
      promo_used: data.promo_used || data.promoCode || data.promo_code,
      promo_code: data.promo_code || data.promoCode || data.promo_used,
    };
    const res = await fetch('/api/admin/passes/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  async selectPassDrink(passId: string, drinkId: string, selectedAromas?: string[]): Promise<{ success: boolean; pass: Pass; drink?: any; message?: string }> {
    const res = await fetch('/api/passes/select-drink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId, drinkId, selectedAromas: selectedAromas || [] }),
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

export async function getPassesForPaymentPoint(eventId?: string): Promise<Pass[]> {
  return api.getPaymentPointPasses(eventId);
}
