# 🚀 Nouvelles Fonctionnalités — Ustrohosting Share

Liste de fonctionnalités proposées pour transformer Ustrohosting Share en une plateforme de partage premium et complète.

---

## 🎨 Expérience Utilisateur

### FEAT-001 · Prévisualisation de fichiers en ligne
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Permettre aux destinataires de prévisualiser les fichiers directement dans le navigateur sans les télécharger.
- **Images** : Galerie avec lightbox, zoom, et navigation par flèches
- **Vidéos** : Lecteur intégré HTML5 avec contrôles
- **PDFs** : Visionneuse PDF intégrée (pdf.js)
- **Audio** : Lecteur audio avec waveform visuel
- **Code/Texte** : Affichage avec coloration syntaxique

**Impact** : Fonctionnalité la plus demandée sur les plateformes de partage. Réduit drastiquement le temps nécessaire pour consulter un fichier partagé.

---

### FEAT-002 · Liens auto-destructeurs (Burn After Reading)
**Priorité** : ⭐⭐⭐⭐⭐
**Description** : Option "Burn after reading" qui supprime automatiquement le partage après le premier téléchargement. Idéal pour l'envoi de documents sensibles (mots de passe, clés API, documents confidentiels).
- Compteur visuel : "Ce lien sera détruit après consultation"
- Animation de destruction une fois lu
- Notification au créateur quand le lien est consulté

---

### FEAT-003 · QR Code amélioré et partageable
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

### FEAT-005 · Notifications push en temps réel
**Priorité** : ⭐⭐⭐
**Description** : Notifications dans le navigateur (Service Worker / Web Push) pour informer les utilisateurs :
- Quand quelqu'un télécharge leur fichier
- Quand un reverse share est utilisé
- Quand un partage est sur le point d'expirer (24h avant)

---

## 🛡️ Administration

### FEAT-006 · Quotas de stockage par utilisateur
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

### FEAT-016 · Migration vers PostgreSQL
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

### FEAT-018 · Stockage multi-provider intelligent
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

- [ ] **Étape 1** : Migrer vers PostgreSQL (FEAT-016)
- [ ] **Étape 2** : Activer S3 pour le stockage des fichiers
- [ ] **Étape 3** : Mettre Cloudflare en frontal (CDN + protection)
- [ ] **Étape 4** : Ajouter Redis pour les sessions et le cache
- [ ] **Étape 5** : Externaliser les tâches lourdes (ZIP, email, scan) dans une queue
- [ ] **Étape 6** : Déployer N instances derrière un load balancer
- [ ] **Étape 7** : PostgreSQL read replicas pour les lectures analytics
- [ ] **Étape 8** : Monitoring centralisé (Prometheus + Grafana)
- [ ] **Étape 9** : Alerting automatisé (disk > 80%, latence > 500ms, error rate > 1%)
- [ ] **Étape 10** : Backups automatiques quotidiens vers un stockage distant

