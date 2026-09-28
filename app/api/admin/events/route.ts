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
    const { title, date, location, pre_orders_enabled, max_passes_per_user, image_url, drinks } = await req.json();

    const { data: event, error } = await supabaseAdmin.from('events').insert({ 
      title, 
      date, 
      location, 
      pre_orders_enabled, 
      max_passes_per_user,
      image_url
    }).select().single();

    if (error) throw error;
    
    // Insert drinks if provided
    if (drinks && drinks.length > 0 && event) {
      const drinksToInsert = drinks.map((drink: any) => ({
        event_id: event.id,
        name: drink.name
      }));
      const { error: drinksError } = await supabaseAdmin.from('drink_menus').insert(drinksToInsert);
      if (drinksError) console.error("Error inserting drinks:", drinksError);
    }

    return NextResponse.json({ success: true, event });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { id, title, date, location, pre_orders_enabled, max_passes_per_user, image_url, drinks } = await req.json();

    if (!id) throw new Error("Missing event id");

    const { data: event, error } = await supabaseAdmin.from('events').update({ 
      title, 
      date, 
      location, 
      pre_orders_enabled, 
      max_passes_per_user,
      image_url
    }).eq('id', id).select().single();

    if (error) throw error;
    
    // For simplicity with drinks, just delete old ones and insert new ones
    await supabaseAdmin.from('drink_menus').delete().eq('event_id', id);
    if (drinks && drinks.length > 0) {
      const drinksToInsert = drinks.map((drink: any) => ({
        event_id: id,
        name: drink.name
      }));
      const { error: drinksError } = await supabaseAdmin.from('drink_menus').insert(drinksToInsert);
      if (drinksError) console.error("Error updating drinks:", drinksError);
    }

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) throw new Error("Missing eventId");

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
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
