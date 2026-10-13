"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { formatImageUrl } from '@/lib/utils/url';
import type { NewsItem } from '@/lib/services/api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface CreateNewsPayload {
  title: string;
  content: string;
  imageUrl?: string;
}

/**
 * Server Action: createNewsAction
 * Validates inputs, formats image URL (including GitHub raw converter),
 * and persists the article under the active admin's ID.
 */
export async function createNewsAction(payload: CreateNewsPayload): Promise<{ success: boolean; news?: NewsItem; error?: string }> {
  try {
    const { error: authError, user } = await requireRole(['admin']);
    if (authError || !user) {
      return { success: false, error: 'Non autorisé: Droits administrateur requis.' };
    }

    const { title, content, imageUrl } = payload || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return { success: false, error: 'Le titre est obligatoire.' };
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return { success: false, error: 'Le contenu de l\'actualité est obligatoire.' };
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

    if (insertError || !newArticle) {
      console.error('[createNewsAction] Insert error:', insertError);
      return { success: false, error: 'Impossible de publier l\'actualité.' };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/news');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/news');

    return {
      success: true,
      news: {
        ...newArticle,
        admin_profile: newArticle.profiles || null,
      },
    };
  } catch (err: any) {
    console.error('[createNewsAction] Error:', err);
    return { success: false, error: err.message || 'Erreur serveur.' };
  }
}

/**
 * Server Action: deleteNewsAction
 * Deletes a news announcement by ID. Requires ADMIN role.
 */
export async function deleteNewsAction(newsId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: authError } = await requireRole(['admin']);
    if (authError) {
      return { success: false, error: 'Non autorisé: Droits administrateur requis.' };
    }

    if (!newsId) {
      return { success: false, error: 'ID de l\'actualité manquant.' };
    }

    const { error: deleteError } = await supabaseAdmin
      .from('news')
      .delete()
      .eq('id', newsId);

    if (deleteError) {
      console.error('[deleteNewsAction] Delete error:', deleteError);
      return { success: false, error: 'Erreur lors de la suppression.' };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/news');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/news');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteNewsAction] Error:', err);
    return { success: false, error: err.message || 'Erreur serveur.' };
  }
}

/**
 * Server Action: getNewsAction
 * Fetches all news ordered by created_at DESC.
 */
export async function getNewsAction(): Promise<{ success: boolean; news: NewsItem[]; error?: string }> {
  try {
    const { data: news, error } = await supabaseAdmin
      .from('news')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getNewsAction] Fetch error:', error);
      return { success: false, news: [], error: 'Erreur lors du chargement des actualités.' };
    }

    const formattedNews = (news || []).map((item: any) => ({
      ...item,
      admin_profile: item.profiles || null,
    }));

    return { success: true, news: formattedNews };
  } catch (err: any) {
    console.error('[getNewsAction] Error:', err);
    return { success: false, news: [], error: err.message || 'Erreur serveur.' };
  }
}
