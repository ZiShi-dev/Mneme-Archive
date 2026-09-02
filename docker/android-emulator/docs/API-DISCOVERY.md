# Découverte API — Realm Novel / Sky Novel

## Apps analysées

| App | Package | API embarquée |
|-----|---------|---------------|
| عالم الروايات | `com.realmnovel.novel_app` | `https://api.novels-app.com/api` |
| سماء الروايات | `com.myapp.novels_sky` | `baseUrl` dynamique (Firebase / app-update) |

**Note :** le domaine `api.novels-app.com` ne résout plus (NXDOMAIN). L’API live utilisée par Sky Novel est `http://62.171.141.197:5007` (embarquée dans `libapp.so`).

**Chapitres 51+ (sept. 2026, capture Packet Capture Pro) :** aucune auth JWT. Headers exacts de l’app :

```http
GET /novels/{novelId}/chapters/{n} HTTP/1.1
user-agent: Dart/3.9 (dart:io)
content-type: application/json
x-app-version: 10
accept-encoding: gzip
host: 62.171.141.197:5007
```

- `x-app-version: 10` — **pas** `10.0.0` (sinon `403 غير مصرح`)
- `user-agent: Dart/3.9 (dart:io)` — **pas** `okhttp/4.12.0`
- Pas de `Authorization`, `deviceId`, ni `x-app-package` sur les lectures de chapitre

Auth (`/auth/register`, JWT, `/push/register`) sert aux comptes utilisateur, pas à la lecture publique des chapitres.

Script de sonde : `scripts/probe-skynovel-auth.mjs`

### Capturer le trafic HTTP clair (téléphone réel)

Le proxy HTTP global Android **ne capture pas** `http://62.171.141.197:5007` (HTTP direct). Utiliser une app VPN locale :

1. Installer **Packet Capture** ou **HttpCanary** sur le POCO
2. Lancer la capture, ouvrir Sky Novel, lire le chapitre **51**
3. Exporter la requête vers `62.171.141.197:5007` (headers complets)
4. Coller le résultat ou définir `SKYNOVEL_AUTH_TOKEN` / `SKYNOVEL_BUILD_SIGNATURE` dans l’env serveur Manhaw

Après capture MITM : `adb shell settings put global http_proxy :0` pour désactiver le proxy.

## Endpoints Realm Novel (libapp.so)

Base : `{apiBase}/` où `apiBase = https://api.novels-app.com/api`

| Route | Usage probable |
|-------|----------------|
| `/novels/` | Détails roman |
| `/novels/search` | Recherche |
| `/chapters/` | Contenu chapitre (par ID chapitre) |
| `/chapters?page=` | Liste paginée |
| `/downloads/chapter/` | Téléchargement |
| `/home` | Accueil app |
| `free_chapters_limit` | Limite web = 50 |

## Endpoints Sky Novel (libapp.so)

| Route | Usage probable |
|-------|----------------|
| `/novels/`, `/novels/latest`, `/novels/search` | Catalogue |
| `/chapter/`, `/chapters/` | Chapitres |
| `/app-update/check?version=` | Config / base URL |
| `/socket.io`, `/engine.io` | Temps réel |

## realmnovel.com/api (site)

API JSON distincte du site HTML. Routes confirmées :

| Route | Réponse |
|-------|---------|
| `GET /api/chapters/{id}` | `الفصل غير موجود` si ID invalide (route **existe**) |
| `GET /api/chapters/{novelId}` avec novelId | idem (novelId ≠ chapterId) |
| `GET /api/novels/...` | `المسار غير موجود` |

Les chapitres API utilisent probablement un **ID MongoDB de chapitre**, pas le numéro ni l’ID du roman.

## Site web (public)

| Route | Accès |
|-------|--------|
| Chapitres 1–50 | HTML `chapter-content` |
| Chapitres 51+ | Page locked → app Sky Novel |
| `/_more?page=N` | JSON catalogue |
| `/api/*` | API app (auth / IDs internes) |

## Capturer l’API en live

1. `./scripts/install-mitm-cert.sh` + confirmer dans noVNC
2. Ouvrir Sky Novel ou Realm Novel, lire chapitre **51+**
3. `./scripts/show-captures.sh`

Fichier : `captures/skynovel-flows.jsonl`

## Extraction statique APK

```bash
node scripts/extract-apk-api.mjs apk/extracted-realm-arm64/lib/arm64-v8a/libapp.so
node scripts/extract-apk-api.mjs apk/extracted-sky-full/sky-arm/lib/arm64-v8a/libapp.so
```

APK locaux : `apk/skynovel.apk`, `apk/realmnovel.xapk`
