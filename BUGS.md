# 🐛 Liste des Bugs — Ustrohosting Share

Liste exhaustive de tous les bugs et problèmes techniques identifiés dans le code source.

---

## 🔴 Critiques — Risques de perte de données / sécurité

### BUG-001 · Polyfill `SlowBuffer` dangereux
**Fichier** : [main.ts L1-9](file:///c:/coding/pingvin-share/backend/src/main.ts#L1-L9)
**Description** : Un monkey-patch global injecte un faux `SlowBuffer` au démarrage. Cela masque une incompatibilité de dépendances et pourrait causer des corruptions silencieuses de buffers lors du traitement de gros fichiers.
**Correction** : Identifier la dépendance qui requiert `SlowBuffer`, la mettre à jour, et supprimer le polyfill.

---

### BUG-002 · Variable globale `createdShare` partagée entre onglets
**Fichier** : [upload/index.tsx L26](file:///c:/coding/pingvin-share/frontend/src/pages/upload/index.tsx#L26)
**Description** : `createdShare` et `errorToastShown` sont déclarées comme variables globales de module. Si l'utilisateur ouvre deux onglets d'upload simultanément, ils partagent le même état → conflits de données, fichiers envoyés au mauvais partage.
**Correction** : Déplacer dans un `useRef()` à l'intérieur du composant.

---

### BUG-003 · `Promise.all` sans `await` — Erreurs d'upload perdues
**Fichier** : [upload/index.tsx L230](file:///c:/coding/pingvin-share/frontend/src/pages/upload/index.tsx#L230)
**Description** : `Promise.all(fileUploadPromises);` sans `await`. Si un upload échoue, l'erreur est perdue silencieusement. La complétion du share peut s'exécuter avant que tous les fichiers soient réellement uploadés.
**Correction** : Ajouter `await` devant `Promise.all(...)`.

---

### BUG-004 · Race condition lors de la suppression de partages
**Fichier** : [jobs.service.ts L32-38](file:///c:/coding/pingvin-share/backend/src/jobs/jobs.service.ts#L32-L38)
**Description** : Le job de nettoyage supprime d'abord le record en BDD (`prisma.share.delete`) puis les fichiers physiques (`fileService.deleteAllFiles`). Si le serveur crash entre les deux, les fichiers restent orphelins sur le disque indéfiniment.
**Correction** : Inverser l'ordre — supprimer les fichiers d'abord, puis le record en BDD.

---

### BUG-005 · Suppression de partage sans `await` côté frontend
**Fichier** : [account/shares.tsx L185](file:///c:/coding/pingvin-share/frontend/src/pages/account/shares.tsx#L185)
**Description** : `shareService.remove(share.id)` est appelé sans `await` ni `.then()/.catch()`. L'UI met immédiatement à jour la liste locale, mais si l'API échoue, le partage disparaît de l'écran sans être réellement supprimé côté serveur.
**Correction** : Ajouter `await` et un handler d'erreur avec `toast.axiosError`.

---

## 🟠 Haute priorité — UX & Performance

### BUG-006 · Carte de vitesse d'upload blanche en Dark Mode
**Fichier** : [upload/index.tsx L373-374](file:///c:/coding/pingvin-share/frontend/src/pages/upload/index.tsx#L373-L374)
**Description** : Le fond `rgba(255,255,255,0.75)` est codé en dur. En Dark Mode, la carte apparaît comme un bloc blanc aveuglant.
**Correction** : Utiliser `useMantineTheme()` pour adapter le fond au `colorScheme`.

---

### BUG-007 · Logo sans fallback — Image cassée si fichier absent
**Fichier** : [Logo.tsx](file:///c:/coding/pingvin-share/frontend/src/components/Logo.tsx)
**Description** : Le composant `<img>` n'a aucun handler `onError`. Si `/img/logo.png` n'existe pas (première installation, migration), l'image est cassée sans retour visuel.
**Correction** : Ajouter `onError` qui bascule sur un SVG de fallback inline.

---

### BUG-008 · Cache-buster du logo trop agressif
**Fichier** : [Logo.tsx L7-9](file:///c:/coding/pingvin-share/frontend/src/components/Logo.tsx#L7-L9)
**Description** : `?v=${Date.now()}` est ajouté à **chaque montage** du composant. Chaque navigation de page force un re-téléchargement du logo depuis le serveur.
**Correction** : Utiliser un hash ou un compteur de version provenant du backend plutôt qu'un timestamp.

---

### BUG-009 · `share.removedReason` vérifié AVANT `!share`
**Fichier** : [share.service.ts L270-274](file:///c:/coding/pingvin-share/backend/src/share/share.service.ts#L270-L274)
**Description** : Le code vérifie `share.removedReason` en ligne 270 avant de vérifier `!share` en ligne 273. Si le share n'existe pas, `share.removedReason` provoque un crash `TypeError: Cannot read property of null`.
**Correction** : Inverser l'ordre — vérifier `!share` en premier.

---

### BUG-010 · `deleteAllFiles` et `remove` utilisent le storage provider actuel, pas celui du share
**Fichier** : [file.service.ts L52-59](file:///c:/coding/pingvin-share/backend/src/file/file.service.ts#L52-L59)
**Description** : Les méthodes `remove()` et `deleteAllFiles()` appellent `getStorageService()` sans paramètre, ce qui utilise la config actuelle. Si un share a été créé en `LOCAL` et que la config a ensuite été changée en `S3`, les fichiers locaux ne seront jamais supprimés.
**Correction** : Passer le `storageProvider` du share en paramètre.

---

## 🟡 Moyenne priorité — Qualité de code

### BUG-011 · Fonction `byteToHumanSizeString` dupliquée
**Fichier** : [upload/index.tsx L343-349](file:///c:/coding/pingvin-share/frontend/src/pages/upload/index.tsx#L343-L349)
**Description** : Copie locale d'une fonction qui existe déjà dans `fileSize.util.ts`.
**Correction** : Supprimer et importer depuis `../../utils/fileSize.util`.

---

### BUG-012 · Double injection `ConfigService` dans `ShareService`
**Fichier** : [share.service.ts L28-31](file:///c:/coding/pingvin-share/backend/src/share/share.service.ts#L28-L31)
**Description** : `configService` et `config` sont deux injections du même `ConfigService`.
**Correction** : Supprimer l'une des deux et standardiser.

---

### BUG-013 · 17+ warnings ESLint `no-unused-vars`
**Fichiers** : `Dropzone.tsx`, `FileList.tsx`, `showCreateUploadModal.tsx`, `account/index.tsx`, `audit-logs.tsx`, `admin/index.tsx`, `analytics.tsx`, `upload/index.tsx`
**Description** : Imports et variables inutilisés partout. Augmente le bundle size et réduit la lisibilité.
**Correction** : Nettoyer tous les imports inutilisés.

---

### BUG-014 · `streamToUint8Array` privée jamais utilisée
**Fichier** : [file.service.ts L67-75](file:///c:/coding/pingvin-share/backend/src/file/file.service.ts#L67-L75)
**Description** : Méthode privée `streamToUint8Array` qui n'est appelée nulle part — code mort.
**Correction** : Supprimer.

---

## 🟢 Basse priorité — Branding & Polish

### BUG-015 · Swagger title « Pingvin Share API »
**Fichier** : [main.ts L80](file:///c:/coding/pingvin-share/backend/src/main.ts#L80)
**Correction** : Renommer en `"Ustrohosting Share API"`.

---

### BUG-016 · Discord webhook bot name « Pingvin Share Bot »
**Fichier** : [notification.service.ts L21](file:///c:/coding/pingvin-share/backend/src/notification/notification.service.ts#L21)
**Correction** : Renommer en `"Ustrohosting Share"`.

---

### BUG-017 · Webhook default title « Pingvin Share »
**Fichier** : [notification.service.ts L8](file:///c:/coding/pingvin-share/backend/src/notification/notification.service.ts#L8)
**Correction** : Renommer le paramètre par défaut en `"Ustrohosting Share"`.

---

### BUG-018 · Textes français hardcodés hors i18n
**Fichiers** : `upload/index.tsx`, `analytics.tsx`, `admin/shares.tsx`, `admin/index.tsx`
**Description** : Dozens de chaînes françaises codées en dur au lieu d'utiliser `t()` ou `<FormattedMessage>`. L'application ne sera plus traduisible en anglais ou autre langue.
**Correction** : Extraire dans `fr-FR.ts` et `en-US.ts`.

---

### BUG-019 · Meta SEO — `og:description` incorrectement nommée
**Fichier** : [Meta.tsx L18-24](file:///c:/coding/pingvin-share/frontend/src/components/Meta.tsx#L18-L24)
**Description** : Les balises OG utilisent `name=` au lieu de `property=` (`<meta name="og:title">` devrait être `<meta property="og:title">`).
**Correction** : Remplacer `name` par `property` pour les balises OpenGraph.

---

### BUG-020 · `deleteTemporaryFiles` synchrone — bloque le event loop
**Fichier** : [jobs.service.ts L87-116](file:///c:/coding/pingvin-share/backend/src/jobs/jobs.service.ts#L87-L116)
**Description** : Utilise `readdirSync`, `statSync`, `rmSync` — opérations bloquantes qui gèlent le serveur si le dossier contient beaucoup de fichiers.
**Correction** : Migrer vers `fs.promises.readdir`, `fs.promises.stat`, `fs.promises.rm`.

---

### BUG-021 · `clearShareTokenCookies` crash si JWT malformé
**Fichier** : [share.controller.ts L213](file:///c:/coding/pingvin-share/backend/src/share/share.controller.ts#L213)
**Description** : `this.jwtService.decode(value)` sur les cookies share peut retourner `null` si le token est corrompu. L'accès à `cookie.payload.exp` en L217 provoque un crash.
**Correction** : Filtrer les cookies dont le `payload` est `null`.

---

### BUG-022 · `mkdirSync` pour créer le dossier de share
**Fichier** : [share.service.ts L75-77](file:///c:/coding/pingvin-share/backend/src/share/share.service.ts#L75-L77)
**Description** : Utilise `fs.mkdirSync` (synchrone) dans une méthode `async`. Bloque le thread pour chaque création de share.
**Correction** : Utiliser `await fs.promises.mkdir(...)`.

---

### BUG-023 · Reprise d'upload — données `localStorage` jamais nettoyées si le share expire
**Fichier** : [upload/index.tsx L88-124](file:///c:/coding/pingvin-share/frontend/src/pages/upload/index.tsx#L88-L124)
**Description** : Les clés `pingvin_pending_share*` dans le `localStorage` ne sont jamais nettoyées si le share a expiré côté serveur. Elles s'accumulent indéfiniment.
**Correction** : Ajouter un TTL ou vérifier l'existence du share côté serveur avant de proposer la reprise.

---

### BUG-024 · Le message d'erreur de refresh token inclut incorrectement les login tokens
**Fichier** : [jobs.service.ts L138](file:///c:/coding/pingvin-share/backend/src/jobs/jobs.service.ts#L138)
**Description** : Le log dit `"Deleted X expired refresh tokens"` mais le compteur inclut aussi les login tokens et les reset password tokens.
**Correction** : Corriger le message log.

---

### BUG-025 · `useFsAccessApi={false}` dans Dropzone
**Fichier** : [Dropzone.tsx L139](file:///c:/coding/pingvin-share/frontend/src/components/upload/Dropzone.tsx#L139)
**Description** : Désactive explicitement l'API File System Access. Cela empêche la sélection de dossiers via le bouton "Parcourir" (le bouton du bas). Les dossiers ne fonctionnent qu'en drag-and-drop.
**Correction** : Étudier la possibilité de ré-activer l'API ou d'ajouter un bouton séparé "Sélectionner un dossier" utilisant `showDirectoryPicker()`.

---

## 📊 Résumé

| Priorité | Nombre |
|----------|--------|
| 🔴 Critique | 5 |
| 🟠 Haute | 5 |
| 🟡 Moyenne | 4 |
| 🟢 Basse | 11 |
| **Total** | **25** |
