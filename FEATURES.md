# 🚀 Nouvelles Fonctionnalités — Ustrohosting Share

Liste de fonctionnalités proposées pour transformer Ustrohosting Share en une plateforme de partage premium et complète.

---

## 🎨 Expérience Utilisateur

### FEAT-001 · Prévisualisation de fichiers en ligne - Fait 🟢
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Permettre aux destinataires de prévisualiser les fichiers directement dans le navigateur sans les télécharger.
- **Images** : Galerie avec lightbox, zoom, et navigation par flèches
- **Vidéos** : Lecteur intégré HTML5 avec contrôles
- **PDFs** : Visionneuse PDF intégrée (pdf.js)
- **Audio** : Lecteur audio avec waveform visuel
- **Code/Texte** : Affichage avec coloration syntaxique

**Impact** : Fonctionnalité la plus demandée sur les plateformes de partage. Réduit drastiquement le temps nécessaire pour consulter un fichier partagé.

---

### FEAT-002 · Liens auto-destructeurs (Burn After Reading) - Fait 🟢
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Option "Burn after reading" qui supprime automatiquement le partage après le premier téléchargement. Idéal pour l'envoi de documents sensibles (mots de passe, clés API, documents confidentiels).
- Compteur visuel : "Ce lien sera détruit après consultation"
- Animation de destruction une fois lu
- Notification au créateur quand le lien est consulté

---

### FEAT-003 · QR Code amélioré et partageable - Fait 🟢
**Priorité** : ⭐⭐⭐⭐
**Description** : Le QR code existe déjà côté backend mais n'est pas intégré dans l'UI.
- Afficher le QR code dans le modal de complétion d'upload
- Bouton "Télécharger QR Code en PNG" pour l'imprimer
- QR code personnalisé aux couleurs d'Ustrohosting (logo au centre)
- Partage direct sur WhatsApp / Telegram / Email

---

### FEAT-004 · Thèmes personnalisables
**Priorité** : ⭐⭐⭐
**Description** : Permettre aux utilisateurs de choisir leur thème de couleur (pas seulement Dark/Light).
- Palette de couleurs prédéfinies (Ocean, Forest, Sunset, Midnight, etc.)
- Option pour l'admin de forcer un thème global
- Personnalisation de l'accent color dans les paramètres utilisateur

---

### FEAT-005 · Notifications push en temps réel - Fait 🟢
**Priorité** : ⭐⭐⭐
**Description** : Notifications dans le navigateur (Service Worker / Web Push) pour informer les utilisateurs :
- Quand quelqu'un télécharge leur fichier
- Quand un reverse share est utilisé
- Quand un partage est sur le point d'expirer (24h avant)

---

## 🛡️ Administration

### FEAT-006 · Quotas de stockage par utilisateur - Fait 🟢
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Permettre à l'administrateur de définir une limite de stockage par utilisateur.
- Quota global par défaut configurable dans l'admin
- Quota individuel ajustable par utilisateur
- Barre de progression de l'espace utilisé dans le profil utilisateur
- Alerte automatique à 80% et 95% d'utilisation
- Blocage de l'upload lorsque le quota est dépassé

**Schéma** : Ajouter `storageQuota` (bigint, en bytes) et `storageUsed` (bigint) au modèle `User` dans Prisma.

---

### FEAT-007 · Tableau d'activité en temps réel (Live Feed)
**Priorité** : ⭐⭐⭐⭐
**Description** : Un flux d'activité en direct dans le dashboard admin montrant :
- Uploads en cours (fichier, utilisateur, progression)
- Téléchargements récents
- Connexions/déconnexions
- Alertes de sécurité (tentatives de mot de passe échouées)

Utiliser WebSockets (Socket.io) ou Server-Sent Events (SSE) pour le temps réel.

---

### FEAT-008 · Gestion avancée des utilisateurs
**Priorité** : ⭐⭐⭐⭐
**Description** : Enrichir la page d'administration des utilisateurs avec :
- **Rôles** : Admin, Moderator, User, Guest (au lieu de juste admin/non-admin)
- **Suspension temporaire** : Désactiver un compte sans le supprimer
- **Historique d'activité** par utilisateur : dernière connexion, nombre de partages, volume total
- **Invitation par email** : Envoyer un lien d'invitation à un nouvel utilisateur

---

### FEAT-009 · Export CSV/Excel des statistiques
**Priorité** : ⭐⭐⭐
**Description** : Permettre l'export des données d'analytics et d'audit en CSV ou Excel.
- Export des logs de téléchargement par partage
- Export de la liste complète des partages avec métadonnées
- Export des logs d'audit
- Programmation d'un export automatique hebdomadaire par email

---

### FEAT-010 · Mode maintenance
**Priorité** : ⭐⭐⭐
**Description** : Un interrupteur dans l'admin pour mettre le site en mode maintenance.
- Page dédiée avec message personnalisable
- Les admins peuvent toujours naviguer normalement
- Les téléchargements existants restent accessibles (optionnel)
- Minuterie de fin de maintenance visible pour les visiteurs

---

## 🔒 Sécurité

### FEAT-011 · Chiffrement de bout en bout (E2E)
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Chiffrement côté client des fichiers avant l'upload. Le serveur ne voit jamais les données en clair.
- Chiffrement AES-256-GCM dans le navigateur via Web Crypto API
- La clé de déchiffrement est intégrée dans le fragment URL (`#key=...`) — jamais envoyée au serveur
- Indicateur visuel "🔒 Chiffré de bout en bout" sur les partages
- Option activable/désactivable par partage

**Impact** : Fonctionnalité différenciante majeure face à WeTransfer/Google Drive.

---

### FEAT-012 · Authentification 2FA obligatoire pour les admins
**Priorité** : ⭐⭐⭐⭐
**Description** : Forcer l'activation du TOTP pour tous les comptes administrateurs.
- Prompt de configuration 2FA au premier login admin
- Option de politique globale : "2FA obligatoire pour tous les utilisateurs"
- Support des clés de récupération (backup codes)

---

### FEAT-013 · Watermarking automatique des fichiers
**Priorité** : ⭐⭐⭐
**Description** : Ajouter automatiquement un filigrane (watermark) aux fichiers images et PDFs téléchargés.
- Texte personnalisable (nom du destinataire, date, IP)
- Position configurable (centre, coin, diagonal)
- Opacité ajustable
- Aide à tracer les fuites de documents confidentiels

---

### FEAT-014 · Journal d'accès IP avec géolocalisation sur carte
**Priorité** : ⭐⭐⭐
**Description** : Améliorer la page analytics existante avec une carte du monde interactive.
- Visualisation des téléchargements sur une carte (Leaflet / Mapbox)
- Heatmap des zones géographiques les plus actives
- Timeline animée des téléchargements au fil du temps
- Alertes si téléchargement depuis un pays inattendu

---

### FEAT-015 · Expiration automatique du mot de passe des partages
**Priorité** : ⭐⭐
**Description** : Option pour que le mot de passe d'un partage expire après N heures/jours.
- Après expiration du mot de passe, le partage reste accessible mais le mot de passe doit être redéfini par le créateur
- Notification au créateur quand le mot de passe expire

---

## ⚙️ Infrastructure & Scalabilité

### FEAT-016 · Migration vers PostgreSQL - Fait 🟢
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Le système utilise actuellement SQLite, ce qui pose des limites en production :
- Pas de connexions concurrentes fiables
- Pas de réplication
- Pas d'index full-text natif performant
- Verrouillage complet de la base lors des écritures

Migrer vers PostgreSQL permettrait :
- Haute disponibilité
- Recherche full-text
- Connexions concurrentes illimitées
- Support natif de JSON/JSONB pour les métadonnées

---

### FEAT-017 · API publique documentée avec clés API
**Priorité** : ⭐⭐⭐⭐
**Description** : Exposer une API REST publique pour permettre aux utilisateurs d'automatiser leurs partages.
- Clés API personnelles générables depuis le profil utilisateur
- Documentation Swagger/OpenAPI accessible publiquement
- Endpoints principaux : créer un partage, uploader des fichiers, lister ses partages, supprimer
- Rate limiting par clé API
- SDK CLI optionnel (`ustro upload ./mon-fichier.zip`)

---

### FEAT-018 · Stockage multi-provider intelligent - Fait 🟢
**Priorité** : ⭐⭐⭐⭐
**Description** : Actuellement, le système supporte LOCAL ou S3. Améliorer avec :
- **Tiering automatique** : Fichiers récents sur SSD local, anciens fichiers migrés vers S3 (cold storage)
- **Support multi-buckets S3** : Répartir les fichiers sur plusieurs buckets par région
- **Backblaze B2 / Wasabi** : Ajouter des providers cloud moins chers
- **Déduplication** : Le champ `hash` existe déjà dans le schéma — implémenter la déduplication pour éviter de stocker deux fois le même fichier

---

### FEAT-019 · Backup automatique de la base de données
**Priorité** : ⭐⭐⭐
**Description** : Système automatisé de sauvegarde.
- Backup quotidien de la BDD SQLite/PostgreSQL
- Rétention configurable (7 jours, 30 jours, etc.)
- Envoi vers S3 / stockage distant
- Bouton "Backup maintenant" dans l'admin
- Restauration en un clic depuis l'interface d'administration

---

### FEAT-020 · CDN Edge Caching pour les fichiers publics
**Priorité** : ⭐⭐
**Description** : Intégrer un système de cache CDN pour les fichiers fréquemment téléchargés.
- Headers `Cache-Control` intelligents sur les réponses de fichiers
- Support natif de Cloudflare / AWS CloudFront
- Invalidation automatique du cache à l'expiration du partage
- Réduction de la bande passante serveur pour les partages viraux

---

## 💡 Fonctionnalités Additionnelles

### FEAT-021 · Dossiers et organisation des partages
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Permettre aux utilisateurs d'organiser leurs partages dans des dossiers/catégories.
- Création de dossiers personnalisés (Projets, Clients, Personnel, etc.)
- Drag-and-drop pour réorganiser les partages
- Filtres rapides par dossier dans "Mes partages"
- Dossiers partagés entre utilisateurs (collaboration)
- Couleurs et icônes personnalisables par dossier

---

### FEAT-022 · Partage par email direct (sans compte)
**Priorité** : ⭐⭐⭐⭐
**Description** : Permettre l'envoi de fichiers directement à une adresse email sans que le destinataire ait besoin d'un compte.
- Interface simplifiée "Envoyer à..." avec champ email
- Email élégant avec bouton de téléchargement
- Notification de lecture (le créateur sait quand le fichier a été ouvert)
- Rappel automatique si le fichier n'a pas été téléchargé après X jours
- Support d'envoi à plusieurs destinataires en même temps

---

### FEAT-023 · Commentaires et annotations sur les fichiers
**Priorité** : ⭐⭐⭐⭐
**Description** : Ajouter un système de commentaires sur chaque partage.
- Les destinataires peuvent laisser un commentaire après téléchargement
- Annotations directement sur les images/PDFs (comme Figma)
- Thread de discussion par partage
- Notifications au créateur quand un nouveau commentaire est posté
- Utile pour les workflows de validation (approbation de designs, contrats, etc.)

---

### FEAT-024 · Branding personnalisé par utilisateur (White-label)
**Priorité** : ⭐⭐⭐⭐
**Description** : Permettre aux utilisateurs premium de personnaliser l'apparence de leurs pages de partage.
- Logo custom sur la page de téléchargement
- Couleurs personnalisées (accent, fond, boutons)
- Message d'accueil personnalisé
- Domaine personnalisé (CNAME vers `share.monentreprise.com`)
- Suppression du branding "Ustrohosting" (plan premium)

**Impact** : Fonctionnalité monétisable — les entreprises paieraient pour du white-label.

---

### FEAT-025 · Upload via URL (remote upload)
**Priorité** : ⭐⭐⭐
**Description** : Permettre de créer un partage à partir d'une URL distante sans télécharger le fichier localement d'abord.
- Champ "Coller une URL" dans l'interface d'upload
- Le serveur télécharge le fichier distant et crée le partage
- Support des URLs directes (fichiers), Google Drive, Dropbox, OneDrive
- Barre de progression côté serveur avec polling
- Limite de taille configurable par l'admin

---

### FEAT-026 · Galerie publique (Portfolio de fichiers)
**Priorité** : ⭐⭐⭐
**Description** : Permettre aux utilisateurs de créer une galerie publique de leurs partages.
- Page publique `/u/username` avec tous les partages publics
- Grille de thumbnails pour les images/vidéos
- Bio et avatar personnalisables
- Possibilité de "pin" certains partages en tête
- Idéal pour les photographes, designers, créateurs de contenu

---

### FEAT-027 · Historique et versioning de fichiers
**Priorité** : ⭐⭐⭐
**Description** : Garder un historique des versions lorsqu'un fichier est mis à jour dans un partage.
- Bouton "Mettre à jour ce fichier" sans changer le lien
- Historique des versions avec dates
- Possibilité de restaurer une version précédente
- Diff visuel pour les fichiers texte
- Badge "Mis à jour le..." sur la page de partage

---

### FEAT-028 · Planification d'envoi (Scheduled shares)
**Priorité** : ⭐⭐⭐
**Description** : Programmer l'activation d'un partage à une date/heure future.
- Date picker dans le modal de création
- Le partage reste "brouillon" jusqu'à l'heure programmée
- Notification automatique aux destinataires au moment de l'activation
- Cas d'usage : embargo presse, lancement de produit, contenu saisonnier

---

### FEAT-029 · Tableau de bord utilisateur (User Dashboard)
**Priorité** : ⭐⭐⭐⭐
**Description** : Remplacer la simple liste de partages par un vrai tableau de bord personnel.
- Graphique d'activité (uploads/downloads par semaine)
- Espace de stockage utilisé vs quota
- Partages populaires (les plus téléchargés)
- Activité récente (timeline)
- Raccourcis rapides (nouveau partage, reverse share)

---

### FEAT-030 · Intégrations tierces (Zapier / Webhooks avancés)
**Priorité** : ⭐⭐⭐
**Description** : Étendre le système de webhooks existant (Discord, Slack, Telegram) avec des intégrations plus riches.
- Webhooks personnalisés avec payload configurable (format JSON libre)
- Événements granulaires : upload, download, expiration, suppression, login
- Intégration native Zapier / Make (Integromat) / n8n
- Templates de webhook pré-configurés pour les plateformes populaires
- Log d'historique des webhooks envoyés avec statut (succès/échec/retry)

---

## 📊 Résumé par catégorie

| Catégorie | Nombre | Points forts |
|-----------|--------|-------------|
| 🎨 Expérience Utilisateur | 5 | Prévisualisation, auto-destruction, QR code |
| 🛡️ Administration | 5 | Quotas, live feed, rôles, export |
| 🔒 Sécurité | 5 | E2E, 2FA, watermark, géolocalisation |
| ⚙️ Infrastructure | 5 | PostgreSQL, API publique, multi-provider |
| 💡 Additionnelles | 10 | Dossiers, email direct, commentaires, white-label, versioning |
| **Total** | **30** | |

---

## 🏆 Top 5 des fonctionnalités les plus impactantes

| Rang | Feature | Raison |
|------|---------|--------|
| 1 | **FEAT-001** Prévisualisation de fichiers | Fonctionnalité #1 attendue par les utilisateurs |
| 2 | **FEAT-011** Chiffrement E2E | Avantage concurrentiel majeur |
| 3 | **FEAT-006** Quotas de stockage | Essentiel pour un hébergement multi-utilisateurs |
| 4 | **FEAT-024** White-label / Branding personnalisé | Monétisation et attraction de clients entreprise |
| 5 | **FEAT-016** Migration PostgreSQL | Nécessaire pour la scalabilité en production |

---
---

# 📐 Guide de Scaling — Ustrohosting Share

Comment faire évoluer Ustrohosting Share de quelques utilisateurs à des milliers, en passant par chaque étape.

---

## Phase 1 · Standalone (1-50 utilisateurs)

C'est la configuration actuelle. Un seul conteneur Docker exécute le frontend Next.js, le backend NestJS, et le reverse proxy Caddy.

```
┌─────────────────────────────────────┐
│         Docker Container            │
│  ┌───────────┐  ┌────────────────┐  │
│  │  Caddy    │─▶│  Frontend :3000│  │
│  │  :3000    │  └────────────────┘  │
│  │  (proxy)  │  ┌────────────────┐  │
│  │           │─▶│  Backend :8080 │  │
│  └───────────┘  └───────┬────────┘  │
│                         │           │
│                  ┌──────▼──────┐    │
│                  │  SQLite DB  │    │
│                  │  + Fichiers │    │
│                  └─────────────┘    │
└─────────────────────────────────────┘
```

**Limites** :
- SQLite = 1 writer à la fois (verrouillage global)
- Pas de haute disponibilité (single point of failure)
- Storage limité au disque local
- CPU/RAM d'un seul serveur

**Optimisations rapides** :
- Activer le WAL mode de SQLite (`PRAGMA journal_mode=WAL`) pour de meilleures lectures concurrentes
- Monter un volume SSD pour `/opt/app/backend/data`
- Configurer Cloudflare en frontal pour le caching statique et la protection DDoS
- Ajuster `share.chunkSize` pour optimiser les uploads selon la bande passante

---

## Phase 2 · Séparation des services (50-500 utilisateurs)

Séparer la BDD et le stockage du conteneur applicatif.

```
┌──────────────────┐     ┌─────────────────┐
│  Cloudflare CDN  │     │   PostgreSQL     │
│  (cache + DDoS)  │     │   (dédié)        │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        │
┌──────────────────┐              │
│  Docker App      │──────────────┘
│  Frontend + API  │
│  (Caddy interne) │──────────────┐
└──────────────────┘              │
                                  ▼
                          ┌───────────────┐
                          │  S3 / MinIO   │
                          │  (stockage)   │
                          └───────────────┘
```

**Actions clés** :
1. **Migrer SQLite → PostgreSQL** (FEAT-016)
   - Modifier `prisma/schema.prisma` : `provider = "postgresql"`
   - Exporter les données SQLite et les importer dans PostgreSQL
   - PostgreSQL supporte les connexions concurrentes et la réplication

2. **Activer S3 pour le stockage des fichiers**
   - Configurer `s3.enabled = true` dans l'admin
   - Utiliser MinIO (self-hosted) ou AWS S3 / Backblaze B2 / Wasabi
   - Le disque local ne stocke plus que les fichiers temporaires

3. **Reverse proxy externe** (Nginx / Caddy / Traefik)
   - Terminaison TLS en amont
   - Compression gzip/brotli
   - Rate limiting au niveau du proxy

**docker-compose.yml Phase 2** :
```yaml
services:
  app:
    image: ustrohosting/share:latest
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/share
      - S3_ENABLED=true
      - S3_ENDPOINT=https://s3.ustrohosting.ca
      - S3_BUCKET=share-files
      - S3_ACCESS_KEY=xxx
      - S3_SECRET_KEY=xxx
    depends_on:
      - db
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=share
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

---

## Phase 3 · Scaling horizontal (500-5000 utilisateurs)

Plusieurs instances de l'application derrière un load balancer.

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │  (Traefik/Nginx)│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  App #1  │  │  App #2  │  │  App #3  │
        └─────┬────┘  └─────┬────┘  └─────┬────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Postgres │  │  Redis   │  │  S3 /    │
        │ Primary  │  │ (sessions│  │  MinIO   │
        │ +Replica │  │  + cache)│  │          │
        └──────────┘  └──────────┘  └──────────┘
```

**Prérequis** :
1. **Sessions partagées** : Migrer le stockage des sessions JWT/cookies vers Redis
   - Le refresh token est déjà en BDD, mais les caches mémoire doivent être partagés
   - Installer `@nestjs/cache-manager` avec le store Redis

2. **Sticky sessions ou stateless uploads** :
   - L'upload en chunks pose un défi : le chunk N doit aller au même serveur que le chunk N-1
   - **Solution A** : Sticky sessions via cookie dans le load balancer
   - **Solution B** : Stocker les chunks temporaires directement dans S3 (multipart upload)

3. **PostgreSQL en réplication** :
   - Primary pour les écritures
   - Read replica(s) pour les lectures (analytics, listing)
   - Connexion pool avec PgBouncer

4. **Healthcheck uniformisé** :
   - Chaque instance expose `/api/health`
   - Le load balancer retire automatiquement les instances mortes

**Scaling Kubernetes (optionnel)** :
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ustrohosting-share
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ustrohosting-share
  template:
    spec:
      containers:
      - name: app
        image: ustrohosting/share:latest
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2"
            memory: "2Gi"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

---

## Phase 4 · Architecture distribuée (5000+ utilisateurs)

Pour une plateforme à grande échelle.

```
┌──────────┐    ┌──────────────┐    ┌────────────────┐
│ CDN Edge │───▶│ API Gateway  │───▶│ Upload Service │──▶ S3
│(Cloudflare)│  │  (Kong/Envoy)│    └────────────────┘
└──────────┘    │              │    ┌────────────────┐
                │              │───▶│ Share Service   │──▶ PostgreSQL
                │              │    └────────────────┘
                │              │    ┌────────────────┐
                │              │───▶│ Auth Service    │──▶ Redis
                │              │    └────────────────┘
                │              │    ┌────────────────┐
                │              │───▶│ Analytics Svc   │──▶ ClickHouse
                └──────────────┘    └────────────────┘
```

**Composants clés** :
- **Microservices** : Découper le monolithe NestJS en services indépendants
- **File d'attente** (BullMQ + Redis) : ZIP creation, email sending, ClamAV scanning
- **ClickHouse** pour les analytics : Stockage optimisé pour les données de téléchargements (milliards de lignes)
- **CDN edge caching** : Servir les fichiers populaires depuis 200+ edge locations
- **Auto-scaling** : HPA Kubernetes basé sur CPU/RAM et queue depth

---

## 📏 Métriques de capacité estimées

| Phase | Utilisateurs | Partages/jour | Stockage | Infra mensuelle estimée |
|-------|-------------|---------------|----------|------------------------|
| 1 · Standalone | 1-50 | ~50 | < 500 GB | 10-25$ (VPS) |
| 2 · Séparé | 50-500 | ~500 | 500 GB - 5 TB | 50-150$ |
| 3 · Horizontal | 500-5K | ~5,000 | 5-50 TB | 300-800$ |
| 4 · Distribué | 5K+ | 50,000+ | 50+ TB | 1,500$+ |

---

## 🔧 Checklist de scaling rapide

- [x] **Étape 1** : Migrer vers PostgreSQL (FEAT-016) - *Réalisé* 🟢
- [x] **Étape 2** : Activer S3 pour le stockage des fichiers (FEAT-018) et déployer le Tiering Intelligent en Cascade à 3 Niveaux avec Redondance Multi-MinIO (FEAT-020) - *Réalisé* 🟢
- [x] **Étape 3** : Configurer Cloudflare en frontal pour le CDN et la protection (FEAT-022) - *Partiellement Réalisé* 🟢
  - **Implémenté** : CDN activé via Workers pour les assets statiques et le cache de fichiers.
  - **En attente** : Configuration du DNS load-balancing (Nginx/Traefik) et sécurisation avancée.
- [x] **Étape 4** : Activer Redis pour le cache distribué (sessions/OAuth et cache global via Keyv/Redis) (FEAT-021) - *Réalisé et Vérifié* 🟢
- [x] **Étape 5** : Externaliser les tâches de fond restantes (Emails, Scans ClamAV) dans une file d'attente (Note : le système ZIP est déjà optimal via flux direct S3 en RAM, sans file d'attente nécessaire) (FEAT-023) - *Réalisé et Validé* 🟢
- [ ] **Étape 6** : Déployer N instances derrière un load balancer (stateless frontend scaling)
- [ ] **Étape 7** : PostgreSQL read replicas pour les lectures analytics
- [ ] **Étape 8** : Monitoring centralisé (Prometheus + Grafana)
- [ ] **Étape 9** : Alerting automatisé (disk > 80%, latence > 500ms, error rate > 1%)
- [ ] **Étape 10** : Backups automatiques quotidiens vers un stockage distant

---

## 🌐 Architecture Multi-Serveurs & Partage de Données (Stateless Scaling)

Lorsque le site grandit et qu'on déploie plusieurs serveurs applicatifs (ex: Serveur 1 et Serveur 2) derrière un répartiteur de charge (Load Balancer comme Nginx ou Traefik) pour la redondance et la haute disponibilité, se pose la question de l'accès aux fichiers physiques.

Si le Serveur 1 reçoit un upload local et le stocke sur son SSD, le Serveur 2 ne pourra pas le lire si un internaute est redirigé vers lui pour le téléchargement.

### Solutions pour partager les fichiers entre serveurs

#### 1. L'approche Cloud-Native : Le stockage découplé (S3 / MinIO / B2) — *Recommandée*
C'est le moyen le plus simple et le plus robuste pour scaler à l'infini sans complexité matérielle.
* **Fonctionnement** : Les serveurs applicatifs (Serveur 1 et Serveur 2) sont **stateless** (sans état). Ils ne stockent aucun fichier localement.
* **Mécanique** :
  1. Les deux serveurs se connectent à la même base de données **PostgreSQL** centrale.
  2. Les fichiers physiques sont envoyés et récupérés directement depuis un stockage objet partagé (ex: **Backblaze B2** ou votre serveur **MinIO 24 To**).
* **Partage de session/cache via Redis** : 
  - Pour que les instances partagent le cache de manière cohérente, **Redis** est activé (`cache.redis-enabled` à `true`). 
  - Le backend NestJS configure automatiquement `@keyv/redis` comme magasin de cache global distribué.
  - Ainsi, les nonces d'authentification générés par les providers OAuth (Google, Microsoft, OIDC) ou toute autre donnée mise en cache sont immédiatement accessibles par toutes les instances applicatives, garantissant une expérience utilisateur fluide sans sessions collantes ("sticky sessions").
* **Pourquoi c'est l'idéal ?**
  - Si le Serveur 1 crash, le Load Balancer bascule tout le trafic sur le Serveur 2. Ce dernier accède à la même BDD et aux mêmes fichiers S3. Aucun fichier n'est perdu ni inaccessible.
  - La bande passante est optimisée via les **Presigned URLs** : le client uploade et télécharge son fichier de 10 Go en direct avec le serveur de stockage (B2 ou MinIO), déchargeant totalement le CPU et la bande passante de vos serveurs applicatifs.

#### 2. L'approche Physique / Réseau : Le dossier partagé par réseau (NFS / Ceph)
Si vous souhaitez conserver des fichiers stockés "localement" sur le disque dur physique de vos propres machines sans protocole S3 :
* **Fonctionnement** : Vous utilisez un protocole de fichier réseau comme **NFS (Network File System)** ou **GlusterFS** (système de fichiers distribué).
* **Mécanique** :
  1. Le Serveur 1 (qui a le gros stockage) partage son répertoire de données via NFS sur le réseau local.
  2. Le Serveur 2 monte ce partage NFS réseau dans son propre dossier local `./data/files`.
* **Pourquoi cette approche a des limites ?**
  - Le Serveur 1 devient le "Single Point of Failure" (point de défaillance unique) pour le stockage : s'il s'éteint, le Serveur 2 ne peut plus lire aucun fichier.
  - NFS à travers Internet ou sur un réseau local lent introduit une latence et ralentit les temps de réponse de l'application.

---

## 📈 Plan Écrit de Résolution de la Saturation (1 To SSD)

> [!NOTE]
> **Statut : Entièrement Implémenté et Déployé** 🟢
> Ce plan de résolution est actif et entièrement géré de manière automatique avec une barrière absolue de 100 Go libres sur le SSD local et des cron-jobs de régulation.

Pour tirer le meilleur parti de votre serveur de 1 To tout en évitant les interruptions de service, le plan de transition se structure en 3 paliers automatiques et configurables :

### Palier A · Tiering dynamique et proactif (0 à 800 Go occupés)
* **Objectif** : Garder un maximum de fichiers récents sur le SSD local ultra-rapide.
* **Fonctionnement** :
  - Un cron s'exécute toutes les nuits à 2h00 pour déplacer vers MinIO (24 To) ou B2 tous les partages de plus de `X` jours.
  - L'empreinte unique en base de données (CAS via hash `_files/${hash}`) évite les doublons de fichiers à la source.

### Palier B · Alerte et Accélération du Tiering (800 Go à 900 Go occupés)
* **Objectif** : Empêcher le serveur d'atteindre sa limite critique.
* **Fonctionnement** :
  - Si l'espace disque du serveur 1 To descend en dessous de 20 % (seuil configurable), l'application bascule automatiquement en mode **Tiering Accéléré**.
  - Le cron de migration ne s'exécute plus quotidiennement mais **toutes les heures**, vidant activement le SSD local vers le stockage cloud/externe.
  - L'administrateur reçoit une alerte système (Notification Push et Mail).

### Palier C · Failover "S3 Direct" de secours (Au-delà de 900 Go occupés)
* **Objectif** : Assurer la continuité de service des uploads même si le disque principal est saturé.
* **Fonctionnement** :
  - Si le disque local franchit le seuil de 90 % d'utilisation (100 Go restants), l'application active automatiquement le mode **Direct-to-S3** pour tous les nouveaux uploads.
  - Les fichiers n'écrivent plus un seul octet sur le SSD local du serveur principal. Ils sont dirigés instantanément et à 100 % vers l'espace de stockage externe (MinIO 24 To ou Backblaze B2) jusqu'à ce que l'administrateur libère du stockage ou agrandisse le disque dur.

---

## 🗄️ Tiering Intelligent à 3 Niveaux (Hot ➔ Warm ➔ Cold)

> [!NOTE]
> **Statut : Entièrement Implémenté et Déployé** 🟢
> L'architecture supporte pleinement le cycle de vie local SSD ➔ MinIO LAN ➔ Cloud B2 avec sharding applicatif RAID-0, mirroring RAID-1, et routage intelligent basé sur l'espace disponible réel.

Pour concilier vitesse extrême, coût zéro (auto-hébergé) et sécurité infinie (cloud), l'architecture supporte un cycle de vie des données à **3 niveaux**.

```mermaid
flowchart LR
    A["Client Upload"] -->|1. Écriture immédiate| B["Tier 1 : Hot (SSD 1 To)"]
    B -->|2. Vieillissement (> 7 jours)| C["Tier 2 : Warm (MinIO 24 To)"]
    C -->|3. Saturation (> 85% de 24 To)| D["Tier 3 : Cold (Backblaze B2 Cloud)"]
    
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#bfb,stroke:#333,stroke-width:2px
```

### Le Cycle de Vie d'un Fichier

| Niveau | Emplacement | Type | Coût | Rôle dans l'application |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 : Hot** | SSD du serveur 1 To | Local | Gratuit | Nouveaux partages. Vitesse de lecture/écriture maximale pour l'uploader et les premiers téléchargements. |
| **Tier 2 : Warm** | MinIO sur serveur 24 To | LAN (S3 local) | Gratuit | Archives et partages intermédiaires. Coût de stockage nul pour les gros volumes de données. |
| **Tier 3 : Cold** | Backblaze B2 | Cloud (S3 distant) | ~5$/To/mois | Débordement de sécurité. Activé uniquement si le serveur de 24 To commence à manquer de place. |

### Mécanisme de Migration Cascade (Tier 2 ➔ Tier 3)

Pour gérer automatiquement le trop-plein du serveur de 24 To vers Backblaze B2, surtout si ce serveur est **partagé avec d'autres applications (ex: votre Nextcloud privé)**, le système n'utilise pas un simple pourcentage global fixe, mais l'une des deux stratégies configurables suivantes :

#### Stratégie A · La mesure de l'Espace Libre Réel Restant (Recommandée pour colocation)
* **Principe** : L'application se fiche de savoir qui consomme le stockage. Elle surveille uniquement l'**espace disque libre physique restant** sur le pool de stockage du serveur 24 To.
* **Déclenchement** : 
  - Vous configurez un seuil d'alerte en Go/To (ex: `s3.minioFreeSpaceLimit = 500GB` ou `1TB`).
  - Si Nextcloud ou d'autres fichiers saturent le serveur et qu'il reste moins de 500 Go de libre au total, Pingvin Share le détecte et commence à migrer ses propres fichiers vers B2. Cela protège la machine entière contre une panne de disque saturé.

#### Stratégie B · Le Quota dédié (Enveloppe budgétaire)
* **Principe** : Vous allouez une part fixe du disque de 24 To à Pingvin Share (ex: 5 To maximum) afin de sanctuariser le reste pour Nextcloud.
* **Déclenchement** :
  - Sur MinIO, vous configurez un quota strict sur le bucket de l'application (ex: `mc quota set minio/pingvin-share --size 5TB`).
  - Le script de tiering s'active dès que le bucket Pingvin Share atteint 85 % de son enveloppe dédiée (soit 4,25 To occupés), assurant que l'application ne débordera jamais sur l'espace réservé à Nextcloud.

#### Fonctionnement de la Migration en Cascade :

1. **Surveillance intelligente** :
   Le backend NestJS interroge régulièrement l'API de stockage MinIO pour récupérer l'espace libre réel (Stratégie A) ou le taux de remplissage du quota du bucket (Stratégie B).

2. **Ciblage sélectif** :
   Dès que le seuil limite (espace libre insuffisant ou quota bucket presque atteint) est franchi :
   - Le script cible les partages **les plus anciens** ou **les moins consultés** stockés sur le bucket local.
   
3. **Migration par flux directe (Cross-S3 Stream)** :
   Le backend lit le fichier sous forme de flux depuis MinIO local et l'envoie en direct vers Backblaze B2 (en utilisant l'empreinte unique du hash `_files/${hash}`). Le serveur 1 To ne sert que de passerelle réseau temporaire sans stocker le fichier.
   
4. **Mise à jour atomique dans PostgreSQL** :
   Une fois l'upload validé sur Backblaze B2 :
   - Le champ `s3BucketId` du partage est mis à jour de `"minio-local-24tb"` vers `"backblaze-b2-cloud"`.
   - Le fichier source est supprimé de MinIO pour libérer les 24 To physiques (seulement si ce hash n'est plus référencé par aucun autre partage sur MinIO).

5. **Transparence Absolue** :
   Pour vos utilisateurs, aucun changement. Ils cliquent sur le même lien, et le NestJS backend redirige dynamiquement le flux de téléchargement depuis Backblaze B2 plutôt que depuis votre MinIO. Vos données sont préservées, votre stockage local est libéré, et vous ne payez le cloud B2 que pour le strict nécessaire !

---

## ⚡ FEAT-021 : Cache Distribué avec Redis

Le système possède un support natif complet et robuste pour Redis en tant que couche de cache globale partagée.

### 🛠️ Architecture du Cache NestJS avec Redis

```mermaid
flowchart TD
    subgraph Caching Layer (AppCacheModule)
        A["CacheModule.registerAsync"] --> B{"cache.redis-enabled ?"}
        B -->|Non / Défaut| C["CacheableMemory (Mémoire locale de l'instance)"]
        B -->|Oui| D["Double Stockage (Multi-Store)"]
        D --> E["Store 1 : CacheableMemory (L2 local, rapide, 5000 max items)"]
        D --> F["Store 2 : @keyv/redis (L1 distribué partagé)"]
    end

    subgraph Cas d'usages Applicatifs
        G["OAuth Providers (Google, Microsoft, OIDC)"] -->|set / get / del| A
        H["Sécurité & Validations (Nonces, States)"] -->|Ex: oauth-google-nonce-{state}| A
    end
```

#### 1. Configuration & Dépendances
* **Dépendances de production** : Intégration de `@keyv/redis` (`^4.4.0`) et `@redis/client` (`^1.6.0`) pour un support natif performant.
* **Variables d'environnement & Données de base** (`config.seed.ts`) :
  - `cache.redis-enabled` (booléen, défaut: `false`) : Permet d'activer/désactiver la mise en cache globale Redis.
  - `cache.redis-url` (chaîne de caractères, défaut: `redis://pingvin-redis:6379`, masqué en tant que variable secrète) : URL de connexion standard de l'instance Redis.
  - `cache.ttl` (nombre, défaut: `60`) : Durée de vie par défaut des entrées de cache en secondes.
  - `cache.maxItems` (nombre, défaut: `1000`) : Limite des éléments conservés en mémoire cache locale.

#### 2. Logique d'initialisation (`cache.module.ts`)
* Lors de la phase de bootstrap de l'application NestJS, le `AppCacheModule` charge de manière asynchrone les variables du `ConfigService`.
* Si `cache.redis-enabled` est activé, il instancie un magasin à double niveau (**Multi-Store** Keyv) :
  1. Un cache en mémoire vive de l'instance (`CacheableMemory`) avec une limite de 5000 éléments pour un accès ultra-rapide sans latence réseau.
  2. Le magasin Redis distribué (`createKeyv(redisUrl)`) qui assure que toutes les instances s'accordent et partagent la même version des données.

#### 3. Rôle dans l'Architecture Sans État (Stateless Multi-Instances)
* **Élimination des sessions collantes** : Les jetons d'état d'authentification et nonces de sécurité générés par les modules d'authentification tierce (ex: Google, Microsoft Azure, Generic OpenID Connect) sont écrits dans la couche de cache globale avec un TTL de 5 minutes.
* **Résilience** : Un utilisateur qui démarre un flux de connexion OAuth sur une instance de Pingvin Share (ex: *Serveur 1*) peut finaliser sa transaction et être redirigé de manière totalement transparente sur une autre instance (ex: *Serveur 2*) sans échec d'authentification, puisque le *Serveur 2* partage le même cache Redis distribué pour valider le `nonce` de sécurité.

---

## 🛡️ FEAT-023 : File d'attente d'e-mails (BullMQ) & Antivirus Intelligent avec Bypass

Nous avons implémenté avec succès l'**Étape 5** de la checklist d'optimisation d'entreprise, en introduisant une gestion asynchrone des e-mails par file d'attente et un système haut de gamme d'analyse, d'alerte et d'approbation antivirus pour ClamAV.

### 🛠️ Architecture Technique & Modifications Apportées

```mermaid
flowchart TD
    subgraph File d'attente d'E-mails (BullMQ)
        A["NestJS SMTP Mail Request"] --> B{"cache.redis-enabled ?"}
        B -->|Oui| C["Enregistrement dans la Queue BullMQ"]
        B -->|Non / Hors-ligne| D["Fallback synchrone direct (Nodemailer)"]
        C -->|Job asynchrone| E["Email Worker (Arrière-plan)"]
        E -->|Envoi SMTP réussi| F["Log Succès"]
        E -->|Échec connexion SMTP| G["Retente auto 3 fois (Backoff exponentiel)"]
    end

    subgraph Antivirus Intelligent & Whitelisting Admin
        H["Upload anonyme ou reverse share"] --> I["Scan ClamAV"]
        I -->|Fichier infecté ou suspect| J["Database: isSuspect=true, virusName=threat"]
        J -->|Pas d'effacement physique| K["Préservation des fichiers sur SSD/S3"]
        
        L["Visiteur télécharge le fichier"] --> M{"isSuspect & !isApproved ?"}
        M -->|Oui| N["Affichage de la Modal Premium Mantine (Warning)"]
        N -->|Bouton Ignorer et télécharger| O["Téléchargement forcé via S3/Local"]
        N -->|Bouton Annuler| P["Fermeture Modal"]
        
        Q["Administrateur sur /admin/shares"] -->|Visualise Badge Suspect| R["Action inline: 'Approuver'"]
        R -->|POST /shares/:id/files/:fileId/approve| S["isApproved=true, isSuspect=false en base de données"]
        S -->|Effet immédiat| T["Whitelisting global et disparition des alertes"]
    end
```

#### 1. File d'attente asynchrone d'e-mails (BullMQ & Redis)
* **Intégration de BullMQ** : Ajout et installation de `@nestjs/bullmq` et `bullmq` en dépendances de production.
* **Architecture résiliente dynamique (`email.service.ts`)** :
  * Le bootstrap instancie dynamiquement les objets natifs BullMQ `Queue` et `Worker` si `cache.redis-enabled` est activé en base de données, évitant ainsi tout couplage ou erreur d'injection de dépendances NestJS dans les environnements de déploiement autonomes qui n'utilisent pas Redis.
  * Les invitations de partage et notifications SMTP sont automatiquement encapsulées sous forme de jobs asynchrones poussés dans la file d'attente `"email-queue"`, configurés avec **3 tentatives automatiques** et un **délai de reprise (backoff) exponentiel de 5 secondes**.
  * Si Redis est désactivé ou subit une panne de connexion réseau, le système de messagerie bascule immédiatement et de manière totalement transparente vers un mode de fallback direct par Nodemailer synchrone afin d'offrir une continuité de service irréprochable.

#### 2. Antivirus intelligent non destructif (ClamAV)
* **Bypass pour utilisateurs authentifiés (`clamscan.service.ts`)** :
  * Les analyses antivirus ClamAV sont complètement contournées pour les partages créés par des administrateurs et des utilisateurs enregistrés de confiance (`share.creatorId !== null`). Seuls les partages d'invités/anonymes et les reverse shares externes sont soumis à l'analyse.
* **Marquage en base de données non destructif** :
  * Le schéma Prisma (`schema.prisma`) intègre trois nouveaux champs : `isSuspect` (booléen par défaut `false`), `virusName` (chaîne de caractères optionnelle) et `isApproved` (booléen par défaut `false`).
  * En cas de signature suspecte détectée par ClamAV, le fichier physique n'est plus effacé brutalement. L'enregistrement PostgreSQL correspondant est mis à jour (`isSuspect = true`, `virusName = virus`), préservant l'intégrité de l'upload pour permettre une vérification humaine.

#### 3. Endpoint d'approbation et DTOs de protection
* **Exposition API (`file.controller.ts`)** :
  * Création d'une nouvelle route `POST /api/shares/:shareId/files/:fileId/approve` protégée par `JwtGuard` et `AdministratorGuard` pour accorder des droits d'approbation exclusifs aux administrateurs.
* **Sécurisation de type et DTOs** :
  * Mise à jour de `FileDTO` (`file.dto.ts`) pour exposer les propriétés `isSuspect`, `virusName` et `isApproved`.
  * Ajustement de `AdminShareDTO` (`adminShare.dto.ts`) en utilisant l'utilitaire `OmitType` afin d'intégrer proprement les collections de fichiers et de contourner les restrictions strictes de typages lors des lectures administratives de PostgreSQL.

#### 4. Interface publique premium et Modal d'avertissement Mantine
* **Liste de fichiers réactive (`FileList.tsx`)** :
  * Si un fichier est marqué suspect et non approuvé, l'icône générique est remplacée par une icône d'alerte orange/rouge vibrante `TbAlertTriangle`, son nom s'affiche en rouge foncé avec l'indication précise de la menace détectée entre parenthèses.
  * Au clic sur le bouton de téléchargement, une **Modal de confirmation Premium Mantine** s'affiche. Elle informe le visiteur avec bienveillance, lui détaille la nature de la menace et l'existence potentielle de faux positifs (ex: cracks sains, scripts), et lui présente deux choix : *« Ignorer et télécharger »* (déclenche le transfert de fichier) ou *« Annuler »*.

#### 5. Tableau de bord administratif & Approbation en un clic
* **Whitelisting inline (`ManageShareTable.tsx`)** :
  * L'administrateur visualise instantanément les partages contenant des fichiers suspects grâce à l'apparition de conteneurs à bordures pointillées rouges intégrant le nom des fichiers et la signature de la menace.
  * Un bouton d'action directe en un clic **« Approuver »** appelle l'API d'approbation administrative du backend. Lors du succès, le fichier est instantanément marqué approuvé et sain en base de données, éliminant en temps réel les alertes de sécurité pour tous les visiteurs du site, accompagné d'un toast de notification vert premium.




