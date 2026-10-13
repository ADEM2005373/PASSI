import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { formatImageUrl } from '@/lib/utils/url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/admin/news
 * Returns all published news announcements ordered chronologically.
 */
export async function GET() {
  try {
    const { data: news, error } = await supabaseAdmin
      .from('news')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API /api/admin/news GET] Error:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération des actualités' }, { status: 500 });
    }

    const formattedNews = (news || []).map((item: any) => ({
      ...item,
      admin_profile: item.profiles || null,
    }));

    return NextResponse.json({ news: formattedNews });
  } catch (err: any) {
    console.error('[API /api/admin/news GET] Catch error:', err);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}

/**
 * POST /api/admin/news
 * Creates a new news article / announcement. Requires ADMIN role.
 */
export async function POST(req: NextRequest) {
  const { error: authError, user } = await requireRole(['admin']);
  if (authError || !user) return authError;

  try {
    const body = await req.json();
    const { title, content, imageUrl } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Le titre est requis.' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Le contenu est requis.' }, { status: 400 });
    }

    const sanitizedTitle = title.trim().slice(0, 255);
    const sanitizedContent = content.trim().slice(0, 10000);
    const formattedUrl = imageUrl ? formatImageUrl(imageUrl) : null;

    const { data: newArticle, error: insertError } = await supabaseAdmin
      .from('news')
      .insert({
        title: sanitizedTitle,
        content: sanitizedContent,
        image_url: formattedUrl,
        admin_id: user.id,
      })
      .select('*, profiles(email, full_name)')
      .single();

    if (insertError) {
      console.error('[API /api/admin/news POST] Insert error:', insertError);
      return NextResponse.json({ error: 'Erreur lors de la création de l\'actualité' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      news: {
        ...newArticle,
        admin_profile: newArticle.profiles || null,
      },
    });
  } catch (err: any) {
    console.error('[API /api/admin/news POST] Catch error:', err);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/news?newsId=...
 * Deletes a news announcement. Requires ADMIN role.
 */
export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const newsId = searchParams.get('newsId');

    if (!newsId) {
      return NextResponse.json({ error: 'ID de l\'actualité manquant.' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('news')
      .delete()
      .eq('id', newsId);

    if (deleteError) {
      console.error('[API /api/admin/news DELETE] Delete error:', deleteError);
      return NextResponse.json({ error: 'Erreur lors de la suppression de l\'actualité' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Actualité supprimée avec succès' });
  } catch (err: any) {
    console.error('[API /api/admin/news DELETE] Catch error:', err);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}
