"use server";

import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { PromoCode } from '@/lib/services/api';
import { formatImageUrl } from '@/lib/utils/url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface UpdateEventPayload {
  id: string;
  title?: string;
  date?: string;
  location?: string;
  pre_orders_enabled?: boolean;
  max_passes_per_user?: number;
  image_url?: string;
  description?: string;
  dress_code?: string;
  drinks?: { id?: string; name: string; price?: number }[];
  base_price?: number;
  promo_codes?: PromoCode[];
}

/**
 * Server Action: updateEvent
 * Safely updates an event without destroying associated drinks.
 * Merges relational drink_menus entries by ID and ignores drinks if omitted.
 */
export async function updateEvent(payload: UpdateEventPayload) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  const { 
    id, 
    title, 
    date, 
    location, 
    pre_orders_enabled, 
    max_passes_per_user, 
    image_url, 
    description, 
    dress_code, 
    drinks, 
    base_price, 
    promo_codes 
  } = payload || {};

  if (!id || typeof id !== 'string') {
    throw new Error("Identifiant d'événement manquant ou invalide");
  }

  const updatePayload: Record<string, any> = {};
  if (title !== undefined) updatePayload.title = String(title).slice(0, 200);
  if (date !== undefined) updatePayload.date = date;
  if (location !== undefined) updatePayload.location = String(location).slice(0, 200);
  if (pre_orders_enabled !== undefined) updatePayload.pre_orders_enabled = Boolean(pre_orders_enabled);
  if (max_passes_per_user !== undefined) updatePayload.max_passes_per_user = Number(max_passes_per_user) || 1;
  if (image_url !== undefined) updatePayload.image_url = image_url ? String(formatImageUrl(image_url)).slice(0, 500) : null;
  if (description !== undefined) updatePayload.description = description ? String(description).slice(0, 2000) : null;
  if (dress_code !== undefined) updatePayload.dress_code = dress_code ? String(dress_code).slice(0, 200) : null;
  if (base_price !== undefined) updatePayload.base_price = Math.max(0, Number(base_price) || 0);
  if (promo_codes !== undefined) updatePayload.promo_codes = Array.isArray(promo_codes) ? promo_codes : [];

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (eventError) {
    console.error("Database error in updateEvent server action:", eventError);
    throw new Error("Impossible de mettre à jour l'événement");
  }

  // Relational update logic for drink_menus:
  // Only update drinks if explicitly provided in the payload (not undefined).
  // If undefined, preserve existing drinks completely to prevent accidental data loss.
  if (drinks !== undefined && Array.isArray(drinks)) {
    const { data: currentDrinks, error: fetchErr } = await supabaseAdmin
      .from('drink_menus')
      .select('id, name')
      .eq('event_id', id);

    if (fetchErr) {
      console.error("Error fetching current drinks in updateEvent:", fetchErr);
    } else {
      const existingDrinks = currentDrinks || [];
      const existingDrinkMap = new Map(existingDrinks.map(d => [d.id, d]));

      const validPayloadDrinks = drinks
        .filter((d: any) => d && typeof d.name === 'string' && d.name.trim().length > 0)
        .map((d: any) => ({
          id: d.id && typeof d.id === 'string' && d.id.trim().length > 0 ? d.id.trim() : undefined,
          name: String(d.name).trim().slice(0, 100),
          price: typeof d.price === 'number' ? d.price : 0,
        }));

      const payloadDrinkIds = new Set(
        validPayloadDrinks
          .map(d => d.id)
          .filter((drinkId): drinkId is string => Boolean(drinkId && existingDrinkMap.has(drinkId)))
      );

      // a) Update existing drinks whose name changed
      for (const drink of validPayloadDrinks) {
        if (drink.id && existingDrinkMap.has(drink.id)) {
          const existing = existingDrinkMap.get(drink.id)!;
          if (existing.name !== drink.name) {
            const { error: updateDrinkErr } = await supabaseAdmin
              .from('drink_menus')
              .update({ name: drink.name })
              .eq('id', drink.id);
            if (updateDrinkErr) {
              console.error(`Error updating drink ${drink.id}:`, updateDrinkErr);
            }
          }
        }
      }

      // b) Insert new drinks (drinks without an existing id)
      const drinksToInsert = validPayloadDrinks
        .filter(d => !d.id || !existingDrinkMap.has(d.id))
        .map(d => ({
          event_id: id,
          name: d.name,
          price: d.price ?? 0,
        }));

      if (drinksToInsert.length > 0) {
        const { error: insertErr } = await supabaseAdmin
          .from('drink_menus')
          .insert(drinksToInsert);
        if (insertErr) {
          console.error("Error inserting new drinks in updateEvent:", insertErr);
        }
      }

      // c) Delete only drinks that were explicitly removed
      const drinkIdsToDelete = existingDrinks
        .filter(d => !payloadDrinkIds.has(d.id))
        .map(d => d.id);

      if (drinkIdsToDelete.length > 0) {
        const { error: deleteErr } = await supabaseAdmin
          .from('drink_menus')
          .delete()
          .in('id', drinkIdsToDelete);
        if (deleteErr) {
          console.error("Error deleting removed drinks in updateEvent:", deleteErr);
        }
      }
    }
  }

  const { data: updatedDrinks } = await supabaseAdmin
    .from('drink_menus')
    .select('id, name')
    .eq('event_id', id);

  return {
    success: true,
    event: {
      ...event,
      drink_menus: updatedDrinks || []
    }
  };
}

export interface CreateEventPayload {
  title: string;
  date: string;
  location: string;
  pre_orders_enabled?: boolean;
  max_passes_per_user?: number;
  image_url?: string;
  description?: string;
  dress_code?: string;
  drinks?: { name: string; price?: number }[];
  base_price?: number;
  promo_codes?: PromoCode[];
}

/**
 * Server Action: createEvent
 * Creates a new event with sanitized fields and formatted image URL.
 */
export async function createEvent(payload: CreateEventPayload) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  const { 
    title, 
    date, 
    location, 
    pre_orders_enabled, 
    max_passes_per_user, 
    image_url, 
    description, 
    dress_code, 
    drinks, 
    base_price, 
    promo_codes 
  } = payload || {};

  if (!title || !date || !location) {
    throw new Error('Champs obligatoires manquants (titre, date, lieu)');
  }

  const formattedImage = image_url ? String(formatImageUrl(image_url)).slice(0, 500) : null;

  const { data: newEvent, error: insertError } = await supabaseAdmin
    .from('events')
    .insert({
      title: String(title).slice(0, 200),
      date,
      location: String(location).slice(0, 200),
      pre_orders_enabled: Boolean(pre_orders_enabled),
      max_passes_per_user: Number(max_passes_per_user) || 1,
      image_url: formattedImage,
      description: description ? String(description).slice(0, 2000) : null,
      dress_code: dress_code ? String(dress_code).slice(0, 200) : null,
      base_price: Math.max(0, Number(base_price) || 0),
      promo_codes: Array.isArray(promo_codes) ? promo_codes : [],
    })
    .select()
    .single();

  if (insertError) {
    console.error('Database error in createEvent server action:', insertError);
    throw new Error("Impossible de créer l'événement");
  }

  // Insert drinks if provided
  if (drinks && Array.isArray(drinks) && drinks.length > 0) {
    const validDrinks = drinks
      .filter((d: any) => d && typeof d.name === 'string' && d.name.trim().length > 0)
      .map((d: any) => ({
        event_id: newEvent.id,
        name: String(d.name).trim().slice(0, 100),
        price: typeof d.price === 'number' ? Math.max(0, d.price) : 0,
      }));

    if (validDrinks.length > 0) {
      const { error: drinkErr } = await supabaseAdmin
        .from('drink_menus')
        .insert(validDrinks);
      if (drinkErr) {
        console.error('Error inserting drinks in createEvent:', drinkErr);
      }
    }
  }

  const { data: createdDrinks } = await supabaseAdmin
    .from('drink_menus')
    .select('id, name')
    .eq('event_id', newEvent.id);

  return {
    success: true,
    event: {
      ...newEvent,
      drink_menus: createdDrinks || [],
    },
  };
}
