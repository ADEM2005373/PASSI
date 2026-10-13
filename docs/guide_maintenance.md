# PASSI — Guide d'Exploitation & Manuel de Maintenance

> **Version du document :** 1.0.0  
> **Destinataires :** Administrateurs de la Plateforme, Responsables Caisse, Équipe DevOps  
> **Classification :** Guide Pratique Opérationnel  

---

## 1. Manuel d'Exploitation Quotidienne

### 1.1 Créer un Compte Point de Paiement (Guichetier)
Les points de paiement physiques sont des opérateurs autorisés à encaisser des espèces sans avoir accès aux fonctions sensibles d'administration.

1. Connectez-vous à l'espace administrateur sur `/admin`.
2. Ouvrez l'onglet **"Points de Paiement"** dans le menu latéral.
3. Dans la section *"Créer un nouveau Point de Paiement"* :
   * Saisissez l'adresse email de l'opérateur de caisse (ex: `caisse.djerba1@passi.tn`).
   * Définissez un mot de passe robuste (minimum 8 caractères).
4. Cliquez sur **"Créer le compte Point de Paiement"**.
5. Transmettez les identifiants au guichetier : il devra se connecter via `/staff/login` et sera automatiquement redirigé vers `/payment-point/dashboard`.

---

### 1.2 Émettre un Pass Manuel (VIP, Cadeau, Invitation)
Pour émettre un billet hors du parcours d'achat public (partenaires, invités d'honneur, influenceurs) :

1. Dans la console d'administration, cliquez sur **"Création de Passes"** (`/admin/passes/create`).
2. Sélectionnez l'événement concerné dans la liste déroulante.
3. Renseignez l'identité du bénéficiaire :
   * Prénom et Nom de l'invité.
   * Compte Instagram (optionnel mais conseillé pour le contrôle à l'entrée).
4. Choisissez la **Famille de Pass** :
   * **Pass Normal** : Prix calculé avec option boisson.
   * **Pass VIP** : Coupe-file et boisson exclusive.
   * **Pass Cadeau (Gift)** : Saisissez le message personnalisé d'accompagnement.
   * **Pass Invitation** : Billet officiel à tarif 0 DT, immédiatement au statut `activated`.
5. Validez la création : le pass est généré avec ses QR Codes uniques et est disponible instantanément dans la base.

---

### 1.3 Générer et Exporter les Rapports Financiers & Boissons

#### Rapport Financier des Caisses (PDF)
1. Rendez-vous dans l'onglet **"Points de Paiement"** sur `/admin`.
2. Appliquez les filtres souhaités (Événement spécifique et/ou Date précise).
3. Cliquez sur le bouton rouge **"Exporter Rapport PDF"** :
   * Le document PDF génère automatiquement l'en-tête horodaté, le total des pass encaissés, le montant total perçu en DT, ainsi que le tableau ventilé par caissier et par pass.

#### Rapport d'Approvisionnement du Bar (PDF)
1. Rendez-vous dans l'onglet **"Événements"** sur `/admin`.
2. Sur la carte de l'événement désiré, cliquez sur **"Rapport Boissons (PDF)"**.
3. Le PDF récapitule la volumétrie exacte de chaque type de boisson réservée (Vodka Redbull, Gin Tonic, Bière, Soft) pour guider les commandes et approvisionnements du bar.

---

### 1.4 Suppression Sécurisée d'un Pass
En cas d'erreur de saisie ou de fraude avérée :

1. Dans l'onglet **"Approbations"** (`/admin/approbations`), repérez le pass concerné.
2. Cliquez sur le bouton rouge avec l'icône corbeille **"Supprimer"**.
3. Une fenêtre modale de haute sécurité s'ouvre :
   * Elle rappelle les détails du billet et affiche un avertissement rouge.
   * Pour déverrouiller la suppression, **vous devez taper le nom exact du titulaire du pass** dans le champ de confirmation.
   * *Astuce :* Cliquez sur le nom affiché ou sur le bouton *"Copier le nom"* pour remplir le champ en 1 clic.
4. Le bouton **"Supprimer définitivement"** devient actif (vert) : cliquez dessus pour effacer immédiatement le billet et tous ses QR codes.

---

## 2. Maintenance de l'Infrastructure Supabase

### 2.1 Ajuster les Quotas d'Emails Auth (Rate Limits GoTrue)
Supabase applique par défaut un plafond de 30 à 60 emails/heure sur les projets gratuits pour les vérifications de compte. En prévision d'une forte affluence de réservations :

1. Ouvrez votre projet sur le dashboard Supabase (`https://supabase.com/dashboard`).
2. Rendez-vous dans le menu **Authentication** (icône cadenas) -> **Rate Limits**.
3. Localisez les paramètres suivants :
   * **Email rate limit** (Emails envoyés par heure) : ajustez la valeur (ex: 300 par heure).
   * **Token recovery rate limit** (Demandes de réinitialisation mot de passe).
4. Cliquez sur **Save changes**.

> [!TIP]
> Rappel : Les emails de cycle de vie des pass (approbation / rejet) transitent par votre propre serveur SMTP Gmail (`lib/mailer.ts`) et **ne consomment aucun quota Supabase**.

---

### 2.2 Surveillance de la Volumétrie (Seuil 500 MB)
Le forfait Supabase Free dispose d'un stockage PostgreSQL de 500 MB. Pour garantir que la base reste légère :

1. Vérifiez la taille actuelle dans **Settings -> Project Settings -> Database -> Database Size**.
2. **Maintenance de la table `login_attempts`** :
   * Exécutez régulièrement la fonction SQL de purge intégrée dans le SQL Editor :
     ```sql
     SELECT public.cleanup_expired_login_attempts();
     ```
   * Cette commande supprime toutes les tentatives de connexion antérieures à 24 heures.
3. **Nettoyage des pass rejetés expirés** :
   * Les pass rejetés ont une durée de rétention de 48h. Pour purger manuellement les rejets anciens :
     ```sql
     DELETE FROM public.passes
     WHERE entry_status = 'rejected'
       AND updated_at < (now() - INTERVAL '48 hours');
     ```

---

### 2.3 Exécuter une Sauvegarde Manuelle (`pg_dump`)
Pour extraire une sauvegarde complète de la base avant un grand événement :

1. Récupérez la chaîne de connexion directe dans Supabase :
   * **Settings -> Database -> Connection string -> URI** (Mode *Session*, Port 5432).
2. Ouvrez un terminal administrateur et exécutez la commande :
   ```bash
   pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres" \
     -F c -b -v -f "passi_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. Conservez le fichier `.dump` dans un stockage sécurisé et chiffré.

---

## 3. Guide de Dépannage (Troubleshooting)

### Incident 1 : Les e-mails transactionnels (Gmail SMTP) ne partent pas
* **Symptômes :** Les pass sont approuvés ou rejetés, mais les clients ne reçoivent pas d'email de notification.
* **Diagnostic & Résolution :**
  1. **Vérifier les variables d'environnement Vercel** : Assurez-vous que `SMTP_EMAIL` et `SMTP_APP_PASSWORD` sont bien renseignées en production.
  2. **Vérifier le mot de passe d'application Google** :
     * Connectez-vous sur [Google Account Security](https://myaccount.google.com/security).
     * Rendez-vous dans *Mots de passe des applications*.
     * Si l'ancien mot de passe a été révoqué ou si la double authentification a été modifiée, générez un nouveau mot de passe d'application de 16 caractères et mettez à jour `SMTP_APP_PASSWORD` sur Vercel, puis redéployez.
  3. **Vérifier le quota quotidien Gmail** : Un compte Gmail standard gratuit autorise jusqu'à 500 messages sortants par 24h. Si votre événement dépasse cette volumétrie, basculez vers un compte Google Workspace (2000 messages/jour) ou un relais dédié (Resend / SendGrid).

---

### Incident 2 : Un Point de Paiement ou un Membre du Staff est Bloqué
* **Symptômes :** Le guichetier indique que son mot de passe ne fonctionne plus ou qu'il reçoit un message d'erreur d'authentification.
* **Résolution :**
  1. Rendez-vous dans `/admin/utilisateurs`.
  2. Vérifiez si l'utilisateur est marqué comme **"Suspendu"**. Si c'est le cas, cliquez sur **"Réactiver"**.
  3. Pour réinitialiser le mot de passe du guichetier :
     * Cliquez sur l'icône de crayon (Modifier).
     * Saisissez un nouveau mot de passe dans le formulaire et validez.
  4. Si le compte a été bloqué par le Rate Limiter (plus de 10 tentatives erronées) :
     * Exécutez dans le SQL Editor Supabase :
       ```sql
       DELETE FROM public.login_attempts WHERE email = 'email_du_guichetier@domaine.com';
       ```

---

### Incident 3 : Erreur d'immutabilité lors de la suppression d'un pass activé
* **Symptômes :** L'administrateur tente de supprimer un pass mais reçoit l'erreur : *"Finalized and paid passes are immutable and cannot be deleted"*.
* **Cause :** La base de données possède le trigger de sécurité d'origine qui interdisait toute suppression de pass payé même pour les administrateurs.
* **Résolution :**
  1. Ouvrez le fichier local [`supabase/allow_admin_delete_pass.sql`](file:///c:/Users/MSI/Desktop/passi/supabase/allow_admin_delete_pass.sql).
  2. Copiez l'intégralité du script et collez-le dans le **SQL Editor de Supabase**.
  3. Cliquez sur **Run** : le trigger `prevent_paid_pass_modification()` est instantanément mis à jour pour autoriser les suppressions exécutées par l'administrateur et par la clé `service_role`.
