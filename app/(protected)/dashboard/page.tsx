'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { Search, Calendar, MapPin, Heart, Ticket, User, Home, Compass, LogOut, FileText, ChevronRight, Settings, Moon, ChevronLeft, MoreHorizontal, Clock } from 'lucide-react'
import { api } from '@/lib/services/api'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/context/auth-context'
import { CompleteProfileModal } from '@/components/CompleteProfileModal'
import { PassCard } from '@/components/PassCard'

export default function UserDashboard() {
  const router = useRouter()
  const { user: authUser, logout: contextLogout, refreshUser, isInitializing } = useAuth()
  const [passes, setPasses] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'explorer' | 'reservations' | 'profile' | 'catalog' | 'news' | 'settings'>('explorer')
  const [needsProfile, setNeedsProfile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [authIdentities, setAuthIdentities] = useState<any[]>([])

  useEffect(() => {
    // Initialize dark mode from localStorage or classList
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
      setIsDarkMode(isDark)
      if (isDark) document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDarkMode(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDarkMode(true)
    }
  }

  useEffect(() => {
    if (isInitializing) return
    if (!authUser) {
      router.replace('/login')
      return
    }
    // Show the profile-completion modal if instagram_handle is missing
    setNeedsProfile(!authUser.instagram_handle)
    fetchUserAndPasses()
    
    // Supabase Realtime: Listen for instant updates instead of polling
    const supabase = createClient()
    const channel = supabase
      .channel('passes_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'passes',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          // When a ticket is scanned, fetch the latest data silently
          fetchUserAndPasses(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // We intentionally removed 'activeTab' here so it caches data in memory!
  }, [authUser, isInitializing])

  const fetchUserAndPasses = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const user = authUser
    if (!user) return

    if (user.role === 'barman') {
      router.push('/scanner/barman')
      return
    }
    if (user.role === 'security') {
      router.push('/scanner/security')
      return
    }
    if (user.role === 'admin') {
      // Check if they have linked a Google account
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const isGoogleLinked = authUser?.identities?.some((id: any) => id.provider === 'google') ?? false;

      if (!isGoogleLinked) {
        router.push('/staff/login')
      } else {
        router.push('/admin')
      }
      return
    }

    const { createClient } = await import('@/lib/supabase/client');
    const supabaseClient = createClient();
    const { data: { user: sbUser } } = await supabaseClient.auth.getUser();
    if (sbUser) {
      setAuthIdentities(sbUser.identities || []);
    }

    const [passesData, eventsData] = await Promise.all([
      api.getUserPasses(user.id),
      api.getEvents()
    ]);

    setPasses(passesData || [])
    setEvents(eventsData || [])
    if (showLoading) setLoading(false)
  }

  const handleLogout = async () => {
    await contextLogout()
  }

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchQuery = event.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const matchLocation = searchLocation === '' || event.location?.toLowerCase().includes(searchLocation.toLowerCase());
      const matchDate = searchDate === '' || event.date?.includes(searchDate);
      // Rough matching for categories if event doesn't have a strict category field
      const matchCategory = searchCategory === '' || event.title?.toLowerCase().includes(searchCategory.toLowerCase()) || event.description?.toLowerCase().includes(searchCategory.toLowerCase());
      return matchQuery && matchLocation && matchDate && matchCategory;
    })
  }, [events, searchQuery, searchLocation, searchDate, searchCategory])

  const handleLinkProvider = async (provider: 'google' | 'facebook' | 'instagram') => {
    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === "instagram" && {
          queryParams: { display: "popup" },
        }),
      }
    })
    if (error) {
      console.error(`Error linking ${provider}:`, error.message)
      alert(`Erreur lors de la liaison avec ${provider}`)
    }
  }

  const handleUnlinkProvider = async (provider: string) => {
    const supabase = createClient()
    const identity = authIdentities.find((id: any) => id.provider === provider)
    if (!identity) return

    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) {
      console.error(`Error unlinking ${provider}:`, error.message)
      alert(`Erreur lors de la dissociation de ${provider}: ${error.message}`)
    } else {
      window.location.reload()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-passi-creme dark:bg-passi-bleu flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-passi-corail border-t-transparent rounded-full animate-spin mb-6"></div>
        <div className="text-passi-bleu dark:text-white font-bold text-xl animate-pulse">Chargement de votre espace...</div>
      </div>
    );
  }

  const NavItem = ({ icon, label, id }: { icon: any, label: string, id: any }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`flex items-center space-x-4 w-full p-4 rounded-2xl transition-all duration-300 font-bold ${activeTab === id ? 'bg-passi-corail text-white shadow-lg shadow-passi-corail/30 translate-x-2' : 'text-gray-400 hover:text-white hover:bg-white dark:bg-passi-surface/5'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-passi-creme dark:bg-passi-bleu overflow-hidden">
      {/* Profile completion modal — shown to users who logged in via Google */}
      {needsProfile && authUser && (
        <CompleteProfileModal
          userId={authUser.id}
          onComplete={async () => {
            await refreshUser()
            setNeedsProfile(false)
          }}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="w-72 bg-passi-bleu text-white hidden md:flex flex-col rounded-r-[40px] shadow-2xl z-20">
        <div className="p-10 pb-6">
          <Logo variant="dark" className="w-[120px] h-[35px]" />
        </div>
        <nav className="flex-1 px-6 space-y-3 mt-8 overflow-y-auto hide-scrollbar">
          <NavItem icon={<Home size={22} />} label="Accueil" id="explorer" />
          <NavItem icon={<Compass size={22} />} label="Catalogue" id="catalog" />
          <NavItem icon={<Ticket size={22} />} label="Mes Réservations" id="reservations" />
          <NavItem icon={<FileText size={22} />} label="Actualités" id="news" />
          <NavItem icon={<User size={22} />} label="Mon Profil" id="profile" />
        </nav>
        <div className="p-8 border-t border-white/10 mt-auto">
          <button onClick={handleLogout} className="flex items-center space-x-3 text-gray-400 hover:text-passi-corail transition-colors w-full p-3 rounded-xl font-bold">
            <LogOut size={22} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-5 bg-passi-bleu text-passi-creme rounded-b-[30px] shadow-lg z-20 relative">
          <Logo variant="dark" className="w-[100px] h-[30px]" />
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-32 md:pb-12 hide-scrollbar scroll-smooth">
          
          {(activeTab === 'explorer' || activeTab === 'catalog') && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
              <div className="flex justify-between items-end mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-passi-bleu dark:text-white mt-4 leading-tight">
                  Trouvez votre <br /> prochaine <span className="text-passi-corail">sortie.</span>
                </h1>
                <div className="hidden md:flex items-center space-x-2 text-passi-text-sec text-sm font-medium">
                   <span>Bizerte, TN</span>
                   <MapPin size={16} className="text-passi-corail" />
                </div>
              </div>

              {/* Advanced Search Bar */}
              <div className="bg-white dark:bg-passi-surface p-2 rounded-3xl md:rounded-full shadow-lg shadow-passi-bleu/5 mb-12 border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-2 md:gap-0">
                <div className="flex items-center px-6 py-3 flex-1">
                  <Search size={22} className="text-passi-corail mr-4" />
                  <input 
                    type="text" 
                    placeholder="Rechercher une sortie, un artiste..." 
                    className="w-full outline-none text-passi-bleu dark:text-white font-semibold placeholder-gray-400 bg-transparent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="hidden md:block w-px bg-gray-200 my-3"></div>
                <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-full md:mx-2 group hover:bg-gray-100 dark:bg-slate-700 transition-colors cursor-text">
                  <Calendar size={20} className="text-passi-turquoise mr-3 group-hover:scale-110 transition-transform" />
                  <input 
                    type="date" 
                    className="bg-transparent outline-none text-sm text-passi-bleu dark:text-white font-medium w-32"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-full md:mx-2 mb-2 md:mb-0 group hover:bg-gray-100 dark:bg-slate-700 transition-colors cursor-text">
                  <MapPin size={20} className="text-passi-turquoise mr-3 group-hover:scale-110 transition-transform" />
                  <input 
                    type="text" 
                    placeholder="Lieu"
                    className="bg-transparent outline-none text-sm text-passi-bleu dark:text-white font-medium w-24"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                  />
                </div>
                <button className="bg-passi-corail text-white p-4 rounded-full flex justify-center items-center hover:scale-105 transition-transform shadow-md shadow-passi-corail/40 mx-2 md:mx-0 mb-2 md:mb-0">
                  <Search size={22} />
                </button>
              </div>

              {/* Categories */}
              {activeTab === 'explorer' && (
                <>
                  <div className="flex justify-between items-end mb-8">
                    <h2 className="text-2xl font-extrabold text-passi-bleu dark:text-white">Catégories</h2>
                    <button onClick={() => setActiveTab('catalog')} className="text-sm font-bold text-passi-corail flex items-center hover:underline">Voir tout <ChevronRight size={16} /></button>
                  </div>
                  <div className="flex gap-6 overflow-x-auto pb-6 hide-scrollbar">
                    {['Concerts', 'Spectacles', 'Théâtre', 'Soirées', 'Expériences'].map((cat, i) => (
                      <div 
                        key={cat} 
                        onClick={() => {
                          setSearchCategory(searchCategory === cat ? '' : cat)
                          setActiveTab('catalog')
                        }}
                        className={`flex flex-col items-center min-w-[100px] gap-4 cursor-pointer group p-2 rounded-2xl transition-colors ${searchCategory === cat ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      >
                        <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg group-hover:-translate-y-2 transition-transform duration-300
                          ${i % 3 === 0 ? 'bg-gradient-to-br from-passi-corail to-orange-400 shadow-orange-200' : 
                            i % 3 === 1 ? 'bg-gradient-to-br from-passi-turquoise to-teal-400 shadow-teal-200' : 
                            'bg-gradient-to-br from-passi-bleu to-indigo-900 shadow-indigo-200'}
                          ${searchCategory === cat ? 'ring-4 ring-offset-2 ring-passi-bleu scale-105' : ''}
                        `}>
                          <Ticket size={32} />
                        </div>
                        <span className={`text-sm font-bold ${searchCategory === cat ? 'text-passi-corail' : 'text-passi-bleu dark:text-white'}`}>{cat}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Selections */}
              <h2 className="text-2xl font-extrabold text-passi-bleu dark:text-white mt-12 mb-8">
                {activeTab === 'catalog' ? 'Tous les événements' : 'Nos sélections'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredEvents.length === 0 && (
                  <div className="col-span-full bg-white dark:bg-passi-surface rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-700">
                    <Search size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-passi-bleu dark:text-white mb-2">Aucun résultat</h3>
                    <p className="text-passi-text-sec font-medium">Nous n'avons trouvé aucun événement correspondant à vos critères.</p>
                  </div>
                )}
                {filteredEvents.map((event, index) => (
                  <div key={event.id} className="bg-white dark:bg-passi-surface rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-slate-700 group flex flex-col">
                    <div className="h-56 bg-gray-200 relative overflow-hidden">
                      <img 
                        src={event.image_url && event.image_url !== 'undefined' ? event.image_url : `https://images.unsplash.com/photo-1540039155732-6761b54cb43a?q=80&w=600&auto=format&fit=crop&sig=${index}`} 
                        alt="Event" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <button className="absolute top-4 right-4 bg-white dark:bg-passi-surface/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-passi-corail transition-colors">
                        <Heart size={20} />
                      </button>
                      <div className="absolute bottom-4 left-4 text-white">
                        <span className="bg-passi-corail px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Tendance</span>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="font-extrabold text-xl text-passi-bleu dark:text-white mb-4 leading-tight">{event.title}</h3>
                      <div className="space-y-3 mb-8 flex-1">
                        <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 p-2 rounded-xl">
                          <div className="bg-white dark:bg-passi-surface p-1.5 rounded-lg mr-3 shadow-sm"><Calendar size={16} className="text-passi-turquoise" /></div> 
                          {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 p-2 rounded-xl">
                          <div className="bg-white dark:bg-passi-surface p-1.5 rounded-lg mr-3 shadow-sm"><MapPin size={16} className="text-passi-corail" /></div> 
                          {event.location}
                        </div>
                      </div>
                      <Link href={`/events/${event.id}`} className="block text-center w-full bg-passi-bleu text-white py-4 rounded-2xl font-bold hover:bg-passi-corail transition-colors shadow-lg shadow-passi-bleu/20">
                        Réserver maintenant
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reservations' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl mx-auto">
              <h1 className="text-4xl font-extrabold text-passi-bleu dark:text-white mb-10">Mes réservations</h1>
              
              {loading ? (
                <div className="text-center text-passi-text-sec py-20 animate-pulse">Chargement...</div>
              ) : passes.length === 0 ? (
                <div className="bg-white dark:bg-passi-surface rounded-[3rem] p-16 text-center shadow-lg shadow-gray-100/50 border border-gray-100 dark:border-slate-700">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Ticket size={40} className="text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-passi-bleu dark:text-white mb-3">Aucun billet</h3>
                  <p className="text-passi-text-sec font-medium text-lg mb-8">Vous n'avez pas encore de réservations.</p>
                  <button onClick={() => setActiveTab('explorer')} className="bg-passi-corail text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-transform shadow-lg shadow-passi-corail/30">
                    Explorer les sorties
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {passes.map((pass) => (
                    <div key={pass.id} className="bg-white dark:bg-passi-surface rounded-[2.5rem] shadow-xl shadow-gray-100/50 border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row">
                      {/* Billet Header/Status */}
                      <div className="bg-passi-bleu text-white p-8 md:w-1/3 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                        <div className="relative z-10">
                          <h2 className="text-2xl font-extrabold mb-2">{pass.events?.title || 'Événement Passi'}</h2>
                          <p className="text-passi-creme/80 font-medium">Invité: {pass.guest_first_name} {pass.guest_last_name}</p>
                        </div>
                        <div className="relative z-10 mt-12">
                          <div className="text-xs uppercase tracking-widest font-bold text-passi-creme/60 mb-2">Statut</div>
                          <span className={`inline-block px-5 py-2.5 rounded-2xl text-sm font-extrabold uppercase tracking-wider
                            ${pass.entry_status === 'activated' ? 'bg-passi-turquoise text-passi-bleu dark:text-white' : ''}
                            ${pass.entry_status === 'awaiting_payment' ? 'bg-orange-400 text-white' : ''}
                            ${pass.entry_status === 'pending' ? 'bg-white dark:bg-passi-surface/20 text-white' : ''}
                            ${pass.entry_status === 'scanned' ? 'bg-red-500 text-white' : ''}
                          `}>
                            {pass.entry_status === 'awaiting_payment' ? 'À PAYER' : pass.entry_status}
                          </span>
                        </div>
                      </div>

                      {/* Billet Content */}
                      <div className="p-8 md:w-2/3">
                        {pass.entry_status === 'pending' && (
                          <div className="h-full flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                              <Clock className="text-gray-400" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-passi-bleu dark:text-white mb-2">En attente</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Votre demande est en cours de validation par notre équipe.</p>
                          </div>
                        )}
                        
                        {pass.entry_status === 'awaiting_payment' && (
                          <div className="h-full flex flex-col justify-center bg-orange-50 rounded-3xl p-8 border border-orange-100">
                            <strong className="block text-2xl text-orange-600 mb-3 font-extrabold">Validation réussie ! 🎉</strong> 
                            <p className="text-orange-700 font-medium text-lg leading-relaxed">Veuillez payer en espèces à l'organisateur sur place pour obtenir votre QR Code d'entrée.</p>
                          </div>
                        )}
                        
                        {(pass.entry_status === 'activated' || pass.entry_status === 'scanned') && (
                          <PassCard pass={pass} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'news' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl mx-auto">
               <h1 className="text-4xl font-extrabold text-passi-bleu dark:text-white mb-10">Actualités</h1>
               <div className="bg-white dark:bg-passi-surface rounded-[3rem] p-16 text-center shadow-lg shadow-gray-100/50 border border-gray-100 dark:border-slate-700">
                  <div className="w-24 h-24 bg-passi-creme dark:bg-passi-bleu rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={40} className="text-passi-corail" />
                  </div>
                  <h3 className="text-2xl font-bold text-passi-bleu dark:text-white mb-3">Bientôt disponible</h3>
                  <p className="text-passi-text-sec font-medium text-lg">Retrouvez bientôt toutes les actualités et offres exclusives ici.</p>
               </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-3xl mx-auto bg-white dark:bg-passi-surface rounded-[3rem] shadow-xl shadow-gray-100/50 border border-gray-100 dark:border-slate-700 overflow-hidden">
              {/* Top Banner */}
              <div className="h-48 md:h-64 bg-gradient-to-br from-passi-turquoise/20 to-passi-bleu/10 w-full relative"></div>
              
              <div className="relative z-10 px-6 md:px-14 pb-14 flex flex-col items-center -mt-20 md:-mt-24">
                {/* Profile Picture */}
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-white overflow-hidden bg-white dark:bg-passi-surface mb-6 shadow-xl flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-passi-turquoise to-passi-bleu flex items-center justify-center">
                    <User size={64} className="text-white" />
                  </div>
                </div>
                
                {/* Name */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-passi-bleu dark:text-white mb-10 text-center">{authUser?.email?.split('@')[0] || ''}</h1>
                
                {/* Contact Info */}
                <div className="w-full space-y-4 mb-8 px-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-passi-text-sec font-medium">Phone</span>
                    <span className="text-passi-bleu dark:text-white font-extrabold"></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-passi-text-sec font-medium">Mail</span>
                    <span className="text-passi-bleu dark:text-white font-medium">{authUser?.email || ''}</span>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="w-full h-px bg-gray-100 dark:bg-slate-700 mb-2 -mx-6 w-[calc(100%+3rem)]"></div>
                
                {/* Menu Options */}
                <div className="w-full max-w-xl mx-auto flex flex-col px-4 md:px-0">
                  {/* Dark mode */}
                  <div className="flex items-center justify-between py-6 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                      <Moon size={24} className="text-passi-bleu dark:text-white" />
                      <span className="text-passi-bleu dark:text-white text-base md:text-lg font-bold">Dark mode</span>
                    </div>
                    {/* Toggle switch */}
                    <div 
                      onClick={toggleDarkMode}
                      className={`w-12 h-6 border-2 rounded-full relative cursor-pointer transition-colors duration-300 ${isDarkMode ? 'bg-passi-bleu border-passi-bleu dark:bg-passi-turquoise dark:border-passi-turquoise' : 'bg-white border-passi-bleu hover:bg-gray-50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-transform duration-300 ${isDarkMode ? 'bg-white translate-x-[1.4rem]' : 'bg-passi-bleu translate-x-[0.1rem]'}`}></div>
                    </div>
                  </div>
                  
                  {/* Profile details */}
                  <button onClick={() => setActiveTab('settings')} className="flex items-center gap-4 py-6 border-b border-gray-100 dark:border-slate-700 w-full text-left hover:bg-passi-creme dark:bg-passi-bleu transition-colors -mx-4 px-4 md:-mx-6 md:px-6 w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] rounded-xl mt-2">
                    <User size={24} className="text-passi-bleu dark:text-white" />
                    <span className="text-passi-bleu dark:text-white text-base md:text-lg font-bold">Profile details</span>
                  </button>
                  
                  {/* Settings */}
                  <button className="flex items-center gap-4 py-6 border-b border-gray-100 dark:border-slate-700 w-full text-left hover:bg-passi-creme dark:bg-passi-bleu transition-colors -mx-4 px-4 md:-mx-6 md:px-6 w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] rounded-xl">
                    <Settings size={24} className="text-passi-bleu dark:text-white" />
                    <span className="text-passi-bleu dark:text-white text-base md:text-lg font-bold">Settings</span>
                  </button>
                  
                  {/* Log out */}
                  <button onClick={handleLogout} className="flex items-center gap-4 py-6 border-b border-gray-100 dark:border-slate-700 w-full text-left hover:bg-red-50 transition-colors -mx-4 px-4 md:-mx-6 md:px-6 w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] rounded-xl text-passi-corail">
                    <LogOut size={24} className="text-passi-corail" />
                    <span className="text-passi-corail text-base md:text-lg font-bold">Log out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl mx-auto bg-transparent">
              <div className="md:px-4">
                <button onClick={() => setActiveTab('profile')} className="flex items-center gap-2 text-passi-text-sec text-sm mb-8 hover:text-passi-bleu dark:text-white font-medium transition-colors">
                  <ChevronLeft size={16} /> back to Profile
                </button>
                
                <div className="bg-passi-creme dark:bg-passi-bleu rounded-3xl shadow-sm border border-orange-100 overflow-hidden mb-10 p-6 md:p-10">
                  {/* Header info */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-passi-turquoise to-passi-bleu flex items-center justify-center shadow-md">
                       <User size={32} className="text-white" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-passi-bleu dark:text-white text-xl">{authUser?.email?.split('@')[0] || ''}</h2>
                      <div className="flex items-center text-passi-text-sec text-sm gap-1 mt-1 font-medium">
                        <span className="bg-white dark:bg-passi-surface text-passi-bleu dark:text-white px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm"><FileText size={12} /> 2</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* User Info Form */}
                  <div className="bg-white dark:bg-passi-surface rounded-3xl p-6 md:p-10 shadow-sm mb-10 border border-gray-100 dark:border-slate-700">
                    <h3 className="font-extrabold text-passi-bleu dark:text-white mb-8 text-base md:text-lg uppercase tracking-wide">User Info</h3>
                    
                    <div className="space-y-6 mb-8">
                      <div>
                        <label className="block text-sm font-bold text-passi-text-sec mb-2">First name</label>
                        <input type="text" defaultValue="" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 md:py-4 text-passi-bleu dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-passi-turquoise/30" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-passi-text-sec mb-2">Last name</label>
                        <input type="text" defaultValue="" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 md:py-4 text-passi-bleu dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-passi-turquoise/30" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-passi-text-sec mb-2">Email address</label>
                        <input type="email" defaultValue={authUser?.email || ''} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 md:py-4 text-passi-bleu dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-passi-turquoise/30" />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button className="bg-gray-300 text-passi-bleu dark:text-white px-8 py-4 rounded-xl text-base font-extrabold hover:bg-gray-400 transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </div>
                  
                  {/* Linked Accounts */}
                  <div className="bg-white dark:bg-passi-surface rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="font-extrabold text-passi-bleu dark:text-white mb-6 text-base md:text-lg uppercase tracking-wide">Website Access</h3>
                    
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center py-4 text-sm text-passi-text-sec font-bold border-b border-gray-100 dark:border-slate-700 mb-2">
                        <span className="w-1/3">Website</span>
                        <span className="w-1/3 text-left">Role</span>
                        <span className="w-1/3 text-right"></span>
                      </div>
                      
                      {(['facebook', 'instagram', 'google'] as const).map((provider, index) => {
                        const isLinked = authIdentities.some((id: any) => id.provider === provider)
                        const isLast = index === 2
                        
                        return (
                          <div key={provider} className={`flex justify-between items-center py-6 ${!isLast ? 'border-b border-gray-50 dark:border-slate-700' : ''} text-base md:text-lg font-medium`}>
                            <span className="w-1/3 text-passi-bleu dark:text-white capitalize">{provider}</span>
                            <span className={`w-1/3 ${isLinked ? 'text-passi-text-sec' : 'text-passi-corail'}`}>
                              {isLinked ? 'Linked' : 'Not linked'}
                            </span>
                            <div className="w-1/3 flex justify-end">
                              {isLinked ? (
                                <button 
                                  onClick={() => handleUnlinkProvider(provider)}
                                  className="text-gray-400 hover:text-red-500 text-sm font-bold transition-colors"
                                  title="Unlink account"
                                >
                                  Unlink
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleLinkProvider(provider)}
                                  className="text-passi-turquoise hover:text-passi-turquoise/80 font-bold transition-colors"
                                >
                                  Link
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-passi-surface border-t border-gray-100 dark:border-slate-700 px-6 py-4 flex justify-between items-center z-50 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('explorer')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === 'explorer' ? 'text-passi-corail' : 'text-gray-400'}`}>
          <Home size={24} className={activeTab === 'explorer' ? 'fill-current' : ''} />
          <span className="text-[10px] font-bold">Accueil</span>
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === 'catalog' ? 'text-passi-corail' : 'text-gray-400'}`}>
          <Compass size={24} className={activeTab === 'catalog' ? 'fill-current' : ''} />
          <span className="text-[10px] font-bold">Catalogue</span>
        </button>
        <button onClick={() => setActiveTab('reservations')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === 'reservations' ? 'text-passi-corail' : 'text-gray-400'}`}>
          <Ticket size={24} className={activeTab === 'reservations' ? 'fill-current' : ''} />
          <span className="text-[10px] font-bold">Billets</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === 'profile' ? 'text-passi-corail' : 'text-gray-400'}`}>
          <User size={24} className={activeTab === 'profile' ? 'fill-current' : ''} />
          <span className="text-[10px] font-bold">Profil</span>
        </button>
      </nav>
    </div>
  )
}
