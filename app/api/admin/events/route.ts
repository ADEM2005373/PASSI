import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { formatImageUrl } from '@/lib/utils/url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { title, date, location, pre_orders_enabled, max_passes_per_user, image_url, description, dress_code, drinks, base_price, promo_codes } = body || {};

    if (!title || typeof title !== 'string' || !date || typeof date !== 'string' || !location || typeof location !== 'string') {
      return NextResponse.json({ error: 'Champs obligatoires manquants ou invalides (title, date, location)' }, { status: 400 });
    }

    const validDrinks = (drinks && Array.isArray(drinks))
      ? drinks
          .filter((d: any) => d && typeof d.name === 'string' && d.name.trim().length > 0)
          .map((d: any) => ({
            name: String(d.name).trim().slice(0, 100),
            price: typeof d.price === 'number' ? Math.max(0, d.price) : 0,
            aromas: Array.isArray(d.aromas)
              ? d.aromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
              : []
          }))
      : [];

    const jsonbDrinks = validDrinks.map(d => ({
      name: d.name,
      aromas: d.aromas
    }));

    let event: any = null;
    const insertPayload: Record<string, any> = {
      title: String(title).slice(0, 200), 
      date, 
      location: String(location).slice(0, 200), 
      pre_orders_enabled: Boolean(pre_orders_enabled), 
      max_passes_per_user: Number(max_passes_per_user) || 1,
      image_url: image_url ? String(formatImageUrl(image_url)).slice(0, 500) : null,
      description: description ? String(description).slice(0, 2000) : null,
      dress_code: dress_code ? String(dress_code).slice(0, 200) : null,
      base_price: base_price !== undefined ? Math.max(0, Number(base_price) || 0) : 0,
      promo_codes: Array.isArray(promo_codes) ? promo_codes : [],
      drinks: jsonbDrinks
    };

    const { data: createdEvent, error } = await supabaseAdmin.from('events').insert(insertPayload).select().single();

    if (error) {
      console.warn("Retrying events insert without drinks JSONB:", error);
      delete insertPayload.drinks;
      const { data: retryEvent, error: retryError } = await supabaseAdmin.from('events').insert(insertPayload).select().single();
      if (retryError || !retryEvent) {
        console.error("Database error in events POST:", retryError || error);
        return NextResponse.json({ error: "Impossible de créer l'événement" }, { status: 500 });
      }
      event = retryEvent;
    } else {
      event = createdEvent;
    }
    
    // Insert drinks if provided
    if (validDrinks.length > 0 && event) {
      const drinksToInsert = validDrinks.map((drink: any) => ({
        event_id: event.id,
        name: drink.name,
        price: drink.price,
        aromas: drink.aromas
      }));
      const { error: drinksError } = await supabaseAdmin.from('drink_menus').insert(drinksToInsert);
      if (drinksError) {
        console.warn("Retrying drink_menus insert without aromas column:", drinksError);
        const fallbackDrinks = drinksToInsert.map(({ aromas, ...rest }) => rest);
        await supabaseAdmin.from('drink_menus').insert(fallbackDrinks);
      }
    }

    return NextResponse.json({ success: true, event: { ...event, drinks: jsonbDrinks } });

  } catch (error: any) {
    console.error("Server error in events POST:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, title, date, location, pre_orders_enabled, max_passes_per_user, image_url, description, dress_code, drinks, base_price, promo_codes } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "Identifiant d'événement manquant ou invalide" }, { status: 400 });
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

    const { data: event, error } = await supabaseAdmin.from('events').update(updatePayload).eq('id', id).select().single();

    if (error) {
      console.error("Database error in events PUT:", error);
      return NextResponse.json({ error: "Impossible de mettre à jour l'événement" }, { status: 500 });
    }
    
    // Relational update logic for drink_menus:
    // Only update drinks if explicitly provided in the payload (not undefined).
    // If undefined, preserve existing drinks completely to prevent accidental data loss.
    if (drinks !== undefined && Array.isArray(drinks)) {
      // 1. Fetch current drink_menus for this event
      const { data: currentDrinks, error: fetchErr } = await supabaseAdmin
        .from('drink_menus')
        .select('id, name')
        .eq('event_id', id);

      if (fetchErr) {
        console.error("Error fetching current drinks in PUT:", fetchErr);
      } else {
        const existingDrinks = currentDrinks || [];
        const existingDrinkMap = new Map(existingDrinks.map(d => [d.id, d]));

        // Filter valid drinks from the payload
        const validPayloadDrinks = drinks
          .filter((d: any) => d && typeof d.name === 'string' && d.name.trim().length > 0)
          .map((d: any) => ({
            id: d.id && typeof d.id === 'string' && d.id.trim().length > 0 ? d.id.trim() : undefined,
            name: String(d.name).trim().slice(0, 100),
            price: typeof d.price === 'number' ? d.price : 0,
            aromas: Array.isArray(d.aromas)
              ? d.aromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
              : []
          }));

        // Update events.drinks JSONB column directly
        const jsonbDrinks = validPayloadDrinks.map(d => ({
          name: d.name,
          aromas: d.aromas
        }));
        try {
          await supabaseAdmin
            .from('events')
            .update({ drinks: jsonbDrinks })
            .eq('id', id);
        } catch (err: any) {
          console.warn("Could not update events.drinks JSONB in PUT:", err);
        }

        const payloadDrinkIds = new Set(
          validPayloadDrinks
            .map(d => d.id)
            .filter((drinkId): drinkId is string => Boolean(drinkId && existingDrinkMap.has(drinkId)))
        );

        // a) Update existing drinks whose name or aromas changed
        for (const drink of validPayloadDrinks) {
          if (drink.id && existingDrinkMap.has(drink.id)) {
            const { error: updateDrinkErr } = await supabaseAdmin
              .from('drink_menus')
              .update({ 
                name: drink.name,
                aromas: drink.aromas
              })
              .eq('id', drink.id);
            if (updateDrinkErr) {
              await supabaseAdmin
                .from('drink_menus')
                .update({ name: drink.name })
                .eq('id', drink.id);
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
            aromas: d.aromas,
          }));

        if (drinksToInsert.length > 0) {
          const { error: insertErr } = await supabaseAdmin
            .from('drink_menus')
            .insert(drinksToInsert);
          if (insertErr) {
            console.warn("Retrying drink_menus insert without aromas column:", insertErr);
            const fallbackDrinks = drinksToInsert.map(({ aromas, ...rest }) => rest);
            await supabaseAdmin.from('drink_menus').insert(fallbackDrinks);
          }
        }

        // c) Delete only drinks that were explicitly removed (present in DB, but omitted in payload)
        const drinkIdsToDelete = existingDrinks
          .filter(d => !payloadDrinkIds.has(d.id))
          .map(d => d.id);

        if (drinkIdsToDelete.length > 0) {
          const { error: deleteErr } = await supabaseAdmin
            .from('drink_menus')
            .delete()
            .in('id', drinkIdsToDelete);
          if (deleteErr) {
            console.error("Error deleting removed drinks in PUT:", deleteErr);
          }
        }
      }
    }

    const { data: updatedDrinks } = await supabaseAdmin
      .from('drink_menus')
      .select('id, name')
      .eq('event_id', id);

    return NextResponse.json({ 
      success: true, 
      event: {
        ...event,
        drink_menus: updatedDrinks || []
      } 
    });
  } catch (error: any) {
    console.error("Server error in events PUT:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: "Identifiant eventId manquant" }, { status: 400 });
    }

    // 1. Find all passes for this event
    const { data: eventPasses } = await supabaseAdmin
      .from('passes')
      .select('id')
      .eq('event_id', eventId);

    if (eventPasses && eventPasses.length > 0) {
      const passIds = eventPasses.map((p: any) => p.id);
      // Delete pass_drinks linked to these passes
      await supabaseAdmin.from('pass_drinks').delete().in('pass_id', passIds);
      // Delete the passes
      await supabaseAdmin.from('passes').delete().eq('event_id', eventId);
    }

    // 2. Delete drink_menus for this event
    await supabaseAdmin.from('drink_menus').delete().eq('event_id', eventId);
    
    // 3. Delete the event
    const { error } = await supabaseAdmin.from('events').delete().eq('id', eventId);
    if (error) {
      console.error("Database error in events DELETE:", error);
      return NextResponse.json({ error: "Impossible de supprimer l'événement" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Server error in events DELETE:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}
