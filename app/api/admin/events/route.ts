import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { title, date, location, pre_orders_enabled, max_passes_per_user, image_url, description, dress_code, drinks } = body || {};

    if (!title || typeof title !== 'string' || !date || typeof date !== 'string' || !location || typeof location !== 'string') {
      return NextResponse.json({ error: 'Champs obligatoires manquants ou invalides (title, date, location)' }, { status: 400 });
    }

    const { data: event, error } = await supabaseAdmin.from('events').insert({ 
      title: String(title).slice(0, 200), 
      date, 
      location: String(location).slice(0, 200), 
      pre_orders_enabled: Boolean(pre_orders_enabled), 
      max_passes_per_user: Number(max_passes_per_user) || 1,
      image_url: image_url ? String(image_url).slice(0, 500) : null,
      description: description ? String(description).slice(0, 2000) : null,
      dress_code: dress_code ? String(dress_code).slice(0, 200) : null
    }).select().single();

    if (error) {
      console.error("Database error in events POST:", error);
      return NextResponse.json({ error: "Impossible de créer l'événement" }, { status: 500 });
    }
    
    // Insert drinks if provided
    if (drinks && Array.isArray(drinks) && drinks.length > 0 && event) {
      const drinksToInsert = drinks.map((drink: any) => ({
        event_id: event.id,
        name: String(drink.name || '').slice(0, 100)
      })).filter((d: any) => d.name.length > 0);
      if (drinksToInsert.length > 0) {
        const { error: drinksError } = await supabaseAdmin.from('drink_menus').insert(drinksToInsert);
        if (drinksError) console.error("Error inserting drinks:", drinksError);
      }
    }

    return NextResponse.json({ success: true, event });

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
    const { id, title, date, location, pre_orders_enabled, max_passes_per_user, image_url, description, dress_code, drinks } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "Identifiant d'événement manquant ou invalide" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (title !== undefined) updatePayload.title = String(title).slice(0, 200);
    if (date !== undefined) updatePayload.date = date;
    if (location !== undefined) updatePayload.location = String(location).slice(0, 200);
    if (pre_orders_enabled !== undefined) updatePayload.pre_orders_enabled = Boolean(pre_orders_enabled);
    if (max_passes_per_user !== undefined) updatePayload.max_passes_per_user = Number(max_passes_per_user) || 1;
    if (image_url !== undefined) updatePayload.image_url = image_url ? String(image_url).slice(0, 500) : null;
    if (description !== undefined) updatePayload.description = description ? String(description).slice(0, 2000) : null;
    if (dress_code !== undefined) updatePayload.dress_code = dress_code ? String(dress_code).slice(0, 200) : null;

    const { data: event, error } = await supabaseAdmin.from('events').update(updatePayload).eq('id', id).select().single();

    if (error) {
      console.error("Database error in events PUT:", error);
      return NextResponse.json({ error: "Impossible de mettre à jour l'événement" }, { status: 500 });
    }
    
    // For simplicity with drinks, just delete old ones and insert new ones
    await supabaseAdmin.from('drink_menus').delete().eq('event_id', id);
    if (drinks && Array.isArray(drinks) && drinks.length > 0) {
      const drinksToInsert = drinks.map((drink: any) => ({
        event_id: id,
        name: String(drink.name || '').slice(0, 100)
      })).filter((d: any) => d.name.length > 0);
      if (drinksToInsert.length > 0) {
        const { error: drinksError } = await supabaseAdmin.from('drink_menus').insert(drinksToInsert);
        if (drinksError) console.error("Error updating drinks:", drinksError);
      }
    }

    return NextResponse.json({ success: true, event });
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
