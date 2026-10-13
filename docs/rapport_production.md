# PASSI — Rapport de Production & Architecture Technique

> **Version du document :** 1.0.0  
> **Environnement cible :** Production (Vercel + Supabase Managed Cloud)  
> **Classification :** Document Technique Interne  

---

## 1. Vue d'Ensemble de l'Infrastructure

L'écosystème technique de **PASSI** est conçu sur une architecture Jamstack / Edge-first combinant un framework moderne React/Next.js hébergé sur Vercel et une infrastructure de données PostgreSQL Serverless hébergée sur Supabase.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND & API LAYER                             │
│                                                                             │
│                    Vercel Edge Network / Serverless Runtime                 │
│                 Next.js 16 (App Router) • React 19 • PWA Serwist            │
│                                                                             │
│   • Middleware Edge (Routage des rôles, session, impersonation)            │
│   • API Routes (/api/auth/rate-limit, /api/admin/*, /api/payment-point/*)    │
│   • Server Actions & Static Generation (SSG / SSR hybride)                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS / REST
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND & DATABASE LAYER                         │
│                                                                             │
│                                Supabase Managed Cloud                       │
│                                                                             │
│   • PostgreSQL 15 (Schéma relationnel, index B-Tree, triggers PL/pgSQL)     │
│   • Supabase Auth (GoTrue Engine, JWT sécurisés, OAuth Providers)           │
│   • Row Level Security (RLS) & Politiques d'isolation des tables            │
│   • pg_cron / Edge Functions (Tâches planifiées et purges 48h)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventaire des Variables d'Environnement

Le déploiement en production sur Vercel requiert la configuration des clés suivantes dans **Vercel Dashboard -> Settings -> Environment Variables** :

| Nom de la Variable | Périmètre | Description & Format Attendu |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Serveur | URL de l'instance Supabase (ex: `https://[project-ref].supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Serveur | Clé publique anonyme Supabase autorisée sous politiques RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur Uniquement | Clé secrète super-administrateur (Outrepasse les politiques RLS pour l'API backend) |
| `SMTP_HOST` | Serveur Uniquement | Hôte du serveur SMTP transactionnel (`smtp.gmail.com`) |
| `SMTP_PORT` | Serveur Uniquement | Port sécurisé TLS/SSL (`465` pour SSL, `587` pour STARTTLS) |
| `SMTP_SECURE` | Serveur Uniquement | Booléen (`true` pour le port 465) |
| `SMTP_EMAIL` | Serveur Uniquement | Adresse email expéditrice officielle (`notifications.passi@gmail.com`) |
| `SMTP_APP_PASSWORD` | Serveur Uniquement | Mot de passe d'application Google (16 caractères générés sans espaces) |
| `SMTP_FROM` | Serveur Uniquement | Nom d'affichage de l'expéditeur (ex: `"PASSI Billetterie" <notifications.passi@gmail.com>`) |
| `NEXT_PUBLIC_APP_URL` | Client & Serveur | URL canonique du site en production (ex: `https://passi.tn`) |

> [!CAUTION]
> La clé `SUPABASE_SERVICE_ROLE_KEY` et `SMTP_APP_PASSWORD` ne doivent **JAMAIS** être préfixées par `NEXT_PUBLIC_` ni exposées côté navigateur.

---

## 3. Services Tiers & Intégrations

### 3.1 Messagerie Transactionnelle SMTP (Nodemailer + Gmail App Password)
* **Composant dédié** : `lib/mailer.ts`
* **Cas d'usage** : 
  * Envoi d'email automatique lors de l'approbation d'un pass avec lien direct vers le pass et invitation à régler au guichet.
  * Envoi d'email explicatif lors du rejet d'une demande avec motif précisé par l'administrateur.
* **Résilience** : Le module valide l'existence des identifiants au démarrage et neutralise les erreurs non-fatales en consignant un avertissement sans interrompre la requête utilisateur si le serveur SMTP est momentanément inaccessible.

### 3.2 Fournisseurs d'Authentification OAuth (Google & Meta)
* **Google OAuth 2.0** :
  * Configuré dans *Google Cloud Console -> API & Services -> Credentials*.
  * URI de redirection autorisée : `https://[project-ref].supabase.co/auth/v1/callback`.
* **Meta Login (Facebook / Instagram)** :
  * Configuré dans *Meta for Developers -> Facebook Login -> Paramètres*.
  * Rapprochement d'identité : les logins Instagram sont mappés nativement sur le provider Facebook de Supabase via `prompt: 'select_account'`.

### 3.3 Tâches Planifiées (Cron Jobs & Maintenance Automatique)
* **Suppression des rejets (48 heures)** :
  * Filtre d'affichage doux dans l'API (`Date.now() - updated_at <= 48h`).
  * Procédure de purge en base de données planifiée via `pg_cron` ou webhook Vercel Cron (`CRON_SECRET`).
* **Nettoyage des tentatives de connexion (`cleanup_expired_login_attempts`)** :
  * Purge quotidienne des enregistrements de la table `login_attempts` datant de plus de 24 heures pour éviter tout gonflement inutile de la base de données.

---

## 4. Dispositif de Sécurité en Production

### 4.1 Rate Limiting Anti-Brute-Force (10 Connexions / 24 Heures)
* **Route de contrôle** : `/api/auth/rate-limit`
* **Persistance hybride** :
  * **Couche 1 (Base de données)** : Table relationnelle `public.login_attempts` protégée par RLS (accessible uniquement par `service_role`).
  * **Couche 2 (Cache mémoire LRU)** : Mémoire vive du runtime serverless servant de fallback immédiat en cas d'indisponibilité temporaire de la table.
* **Comportement en cas de violation** :
  * Code HTTP retourné : `429 Too Many Requests`.
  * Message utilisateur : *"Trop de tentatives. Veuillez réessayer demain."*.
  * Réinitialisation automatique du compteur dès qu'une authentification réussit.

### 4.2 Politiques RLS (Row Level Security) Supabase
Chaque table sensible est protégée par des politiques strictes :

```sql
-- Exemple : Table passes
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;

-- 1. Un utilisateur ne peut lire que ses propres passes
CREATE POLICY "Users view own passes"
    ON public.passes FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. Le personnel et les points de paiement ont des accès délégués via le service_role ou des fonctions RPC
-- 3. Les écritures directes non contrôlées sont rejetées
```

### 4.3 Triggers d'Immutabilité (`prevent_paid_pass_modification`)
* Le trigger `enforce_pass_immutability` veille sur la table `passes`.
* Dès qu'un billet atteint le statut `activated` ou `scanned`, toute modification des champs sensibles (`user_id`, `event_id`, `final_price`) est rejetée avec une exception PostgreSQL.
* Seul l'administrateur authentifié peut, via la route sécurisée de suppression avec confirmation nominative, déroger à cette règle pour purger un billet erroné.
