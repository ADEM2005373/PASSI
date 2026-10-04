"use client"

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { ArrowRight, Moon, Sun, Ticket, ShieldCheck, Zap, Sparkles, Instagram } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/services/api'
import { Logo } from '@/components/Logo'

export default function LandingPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-passi-creme dark:bg-passi-bleu text-passi-bleu dark:text-passi-creme transition-colors duration-300 font-sans overflow-x-hidden">
      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-passi-creme/80 dark:bg-passi-bleu/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
              <Logo className="w-[100px] h-[32px] md:w-[140px] md:h-[45px]" />
            </Link>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6">
            {mounted && (
              <button 
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-passi-bleu dark:text-passi-creme hover:scale-110 transition-transform"
                aria-label="Toggle Dark Mode"
              >
                {resolvedTheme === 'dark' ? <Sun size={18} className="md:w-5 md:h-5" /> : <Moon size={18} className="md:w-5 md:h-5" />}
              </button>
            )}
            <Link href="/login" className="text-sm md:text-base font-bold text-passi-bleu dark:text-passi-creme hover:text-passi-corail dark:hover:text-passi-corail transition-colors">
              Connexion
            </Link>
            <Link href="/login" className="bg-passi-corail text-white px-6 py-2.5 rounded-full font-bold hover:bg-passi-corail/90 shadow-lg shadow-passi-corail/30 transition-all hover:scale-105 hidden sm:block">
              Rejoindre
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-passi-turquoise/20 rounded-full blur-3xl -z-10 mix-blend-multiply dark:mix-blend-lighten animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-passi-corail/20 rounded-full blur-3xl -z-10 mix-blend-multiply dark:mix-blend-lighten animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="flex-1 space-y-8 text-center lg:text-left z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Réinventez <br />
            vos <span className="text-transparent bg-clip-text bg-gradient-to-r from-passi-corail to-orange-400">Sorties.</span>
          </h1>
          <p className="text-xl md:text-2xl text-passi-text-sec font-medium max-w-2xl mx-auto lg:mx-0">
            Passi est le système ultime de billetterie intelligente. Rapide, sécurisé et conçu pour vous offrir la meilleure expérience événementielle.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
            <Link href="/login" className="bg-passi-bleu dark:bg-white text-white dark:text-passi-bleu px-8 py-4 rounded-full font-extrabold text-lg flex items-center gap-2 hover:scale-105 transition-transform shadow-xl w-full sm:w-auto justify-center">
              Commencer <ArrowRight size={20} />
            </Link>
            <Link href="#features" className="bg-white dark:bg-gray-800 text-passi-bleu dark:text-white border border-gray-200 dark:border-gray-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto justify-center flex">
              Découvrir
            </Link>
          </div>
        </div>
        <div className="flex-1 relative w-full max-w-md mx-auto lg:max-w-none">
          <div className="relative w-full aspect-square rounded-[3rem] bg-gradient-to-tr from-passi-corail to-passi-turquoise p-1 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="w-full h-full bg-passi-creme dark:bg-passi-bleu rounded-[2.9rem] overflow-hidden flex items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-40 dark:opacity-20 mix-blend-luminosity"></div>
              <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative z-10 w-full max-w-sm transform -rotate-3 border border-white/20">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-passi-corail font-black text-2xl tracking-tighter">passi.</span>
                  <span className="bg-passi-turquoise/20 text-passi-turquoise px-3 py-1 rounded-full text-xs font-bold uppercase">VIP Pass</span>
                </div>
                <div className="w-full aspect-square bg-white rounded-2xl flex items-center justify-center mb-6 border-4 border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-3 gap-2 w-32 h-32">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`bg-passi-bleu dark:bg-passi-creme rounded-sm ${i === 4 ? 'opacity-0' : ''}`}></div>
                    ))}
                  </div>
                </div>
                <h3 className="font-extrabold text-xl mb-1 text-passi-bleu dark:text-white">Summer Festival</h3>
                <p className="text-sm font-medium text-passi-text-sec">Samedi, 23 Août • 21:00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-passi-surface transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-passi-corail tracking-widest uppercase mb-2">Comment ça marche</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold text-passi-bleu dark:text-white">Le système Passi</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            <FeatureCard 
              icon={<Ticket size={32} />}
              title="Billetterie Sans Friction"
              description="Réservez vos places en quelques clics. Votre billet numérique est instantanément généré et prêt à être scanné."
              color="bg-passi-turquoise"
            />
            <FeatureCard 
              icon={<ShieldCheck size={32} />}
              title="Sécurité Infaillible"
              description="Chaque QR code est crypté et unique. Impossible de le dupliquer. L'accès est validé en temps réel par les agents."
              color="bg-passi-bleu dark:bg-passi-creme"
              iconColor="text-white dark:text-passi-bleu"
            />
            <FeatureCard 
              icon={<Zap size={32} />}
              title="Expérience Complète"
              description="Gérez non seulement vos entrées, mais aussi vos consommations. Tout est centralisé sur un seul et même pass."
              color="bg-passi-corail"
            />
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-24 bg-passi-creme dark:bg-passi-bleu transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-passi-bleu dark:bg-passi-surface rounded-[3rem] p-12 md:p-20 overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-passi-corail/20 rounded-full blur-3xl -z-0"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <h3 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
                  Un écosystème conçu pour tous les acteurs.
                </h3>
                <p className="text-passi-text-sec text-lg font-medium max-w-lg">
                  De l'organisateur au participant, en passant par la sécurité et le bar. Passi connecte tout le monde en temps réel.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Utilisateurs : Un tableau de bord élégant pour gérer ses pass.",
                    "Agents de sécurité : Scan ultra-rapide à l'entrée.",
                    "Barmans : Validation instantanée des boissons.",
                    "Administrateurs : Suivi en direct et statistiques avancées."
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white font-medium">
                      <Sparkles className="text-passi-turquoise flex-shrink-0" size={20} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full md:w-1/3">
                <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 text-center">
                  <div className="text-5xl font-black text-passi-corail mb-2">100%</div>
                  <div className="text-white font-bold uppercase tracking-widest text-sm">Digital & Fluide</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 text-center px-6">
        <h2 className="text-4xl md:text-6xl font-extrabold mb-8 text-passi-bleu dark:text-white">Prêt à vivre l'expérience ?</h2>
        <p className="text-xl text-passi-text-sec font-medium max-w-2xl mx-auto mb-10">Rejoignez la nouvelle génération de billetterie événementielle.</p>
        <Link href="/login" className="inline-block bg-passi-corail text-white px-10 py-5 rounded-full font-extrabold text-xl hover:scale-105 transition-transform shadow-2xl shadow-passi-corail/40">
          Créer un compte gratuit
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-passi-surface py-12 border-t border-gray-100 dark:border-gray-800 transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/">
            <Logo className="w-[120px] h-[35px]" />
          </Link>
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <a 
              href="https://www.instagram.com/passi_community_216?stkn=MWNwYzB1NzdmdTZ6ag==" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 text-passi-text-sec hover:text-passi-corail transition-colors font-medium text-sm"
            >
              <Instagram size={20} />
              <span>Visiter notre Instagram</span>
            </a>
            <p className="text-passi-text-sec font-medium text-sm">© {new Date().getFullYear()} Passi. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, color, iconColor = "text-white" }: any) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${color} ${iconColor} shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h4 className="text-xl font-extrabold text-passi-bleu dark:text-white mb-3">{title}</h4>
      <p className="text-passi-text-sec font-medium leading-relaxed">{description}</p>
    </div>
  )
}
