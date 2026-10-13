"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { NewsItem, api } from "@/lib/services/api";
import { createNewsAction, deleteNewsAction } from "@/lib/actions/news";
import { formatImageUrl } from "@/lib/utils/url";
import { 
  Newspaper, 
  Plus, 
  Trash2, 
  Calendar, 
  Image as ImageIcon, 
  Sparkles, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export function NewsManagementSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Alert/Status notification
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAllNews = async () => {
    try {
      const items = await api.getNews();
      setNews(items);
    } catch (err) {
      console.error("[NewsManagementSection] Error loading news:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNews();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotification('error', 'Veuillez saisir un titre pour l\'actualité.');
      return;
    }
    if (!content.trim()) {
      showNotification('error', 'Veuillez saisir le contenu de l\'actualité.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Execute Server Action
      const result = await createNewsAction({
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });

      if (!result.success || !result.news) {
        throw new Error(result.error || 'Erreur lors de la publication.');
      }

      showNotification('success', '✓ Actualité publiée avec succès !');
      setTitle("");
      setContent("");
      setImageUrl("");
      await fetchAllNews();
    } catch (err: any) {
      console.error("[NewsManagementSection] Creation error:", err);
      showNotification('error', err.message || 'Une erreur est survenue lors de la publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'actualité "${itemTitle}" ?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteNewsAction(id);
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la suppression.');
      }

      showNotification('success', '✓ Actualité supprimée.');
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      console.error("[NewsManagementSection] Delete error:", err);
      showNotification('error', err.message || 'Impossible de supprimer cette actualité.');
    } finally {
      setDeletingId(null);
    }
  };

  // Preview formatted image
  const previewFormattedUrl = imageUrl.trim() ? formatImageUrl(imageUrl.trim()) : "";

  return (
    <div className="space-y-8">
      {/* Status banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ── SECTION 1: FORMULAIRE DE CRÉATION ── */}
      <div className="card p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-800" style={{ borderRadius: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-passi-corail/10 text-passi-corail flex items-center justify-center font-bold">
            <Plus size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Publier une nouvelle actualité
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Diffusez une annonce ou une mise à jour sur le flux d'actualités des utilisateurs.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Titre */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Titre de l'actualité *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Programmation de la soirée estivale dévoilée !"
                className="input w-full p-3.5 rounded-xl font-semibold text-sm"
                required
              />
            </div>

            {/* URL Image */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>URL de l'image (Optionnel)</span>
                <span className="text-[11px] lowercase text-passi-turquoise font-semibold">GitHub blob supporté automatiquement</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... ou lien GitHub"
                  className="input w-full p-3.5 pl-10 rounded-xl text-sm"
                />
                <ImageIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {previewFormattedUrl && (
                <div className="mt-2 flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs">
                  <div className="w-10 h-10 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                    <img
                      src={previewFormattedUrl}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="truncate flex-1 font-mono text-[11px] text-gray-500">
                    Lien formaté : {previewFormattedUrl}
                  </span>
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Contenu du message *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Rédigez l'annonce complète qui sera affichée sur le flux d'actualités..."
                className="input w-full p-3.5 rounded-xl text-sm leading-relaxed"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Publication en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Publier l'actualité</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 2: LISTE DES ACTUALITÉS PUBLIÉES ── */}
      <div className="card p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-800" style={{ borderRadius: '24px' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-passi-turquoise/10 text-passi-turquoise flex items-center justify-center font-bold">
              <Newspaper size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Actualités publiées ({news.length})
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Consultez et gérez les annonces actuellement visibles par les utilisateurs.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-passi-corail" />
            <p className="text-xs font-bold text-gray-400">Chargement des actualités...</p>
          </div>
        ) : news.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-gray-400 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
            Aucune actualité publiée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-[11px] uppercase tracking-wider font-extrabold text-gray-400">
                  <th className="py-3 px-4">Image</th>
                  <th className="py-3 px-4">Titre</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Auteur</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
                {news.map((item) => {
                  const formattedItemDate = new Date(item.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const hasImage = Boolean(item.image_url);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 w-16">
                        {hasImage ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 relative">
                            <img
                              src={formatImageUrl(item.image_url)}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400">
                            <Newspaper size={18} />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        <span title={item.title}>{item.title}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-passi-corail" />
                          <span>{formattedItemDate}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-gray-500 truncate max-w-[140px]">
                        {item.admin_profile?.full_name || item.admin_profile?.email || 'Admin'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(item.id, item.title)}
                          disabled={deletingId === item.id}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 text-xs font-bold"
                          title="Supprimer l'actualité"
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
