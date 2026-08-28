# Capture API Sky Novel (Realm Novel)

Guide pour intercepter les requêtes réseau de l'app **سماء الروايات** (`com.myapp.novels_sky`) et identifier l'API des chapitres 51+.

## Prérequis

- Docker Desktop (Windows) avec WSL2 ou Hyper-V
- ~8 GB RAM libres (émulateur Android)
- Bash (Git Bash ou terminal Cursor)
- ADB sur le PC **optionnel** (les scripts utilisent `docker exec adb`)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Conteneur manhaw-android (budtmo/docker-android)       │
│  ┌──────────────┐         ┌─────────────────────────┐   │
│  │ Émulateur    │ proxy   │ mitmproxy (mitmdump)    │   │
│  │ Android 11   │ ──────► │ port 8080               │   │
│  │ 10.0.2.2:8080│         │ → captures/*.jsonl      │   │
│  └──────────────┘         └─────────────────────────┘   │
│  Ports exposés : 6080 (noVNC), 5555 (ADB), 8080         │
└─────────────────────────────────────────────────────────┘
```

mitmproxy partage le réseau du conteneur émulateur (`network_mode: service:android-emulator`). Depuis Android, `10.0.2.2:8080` pointe vers mitmproxy.

## Démarrage rapide

```bash
cd docker/android-emulator
chmod +x scripts/*.sh
./scripts/continue-capture.sh
```

Ou étape par étape :

**Note Windows** : les scripts utilisent `docker exec adb` (pas besoin d'ADB sur le PC).

Documentation API (analyse APK) : [docs/API-DISCOVERY.md](docs/API-DISCOVERY.md)

## Étapes détaillées

1. Ouvrir l'émulateur : **http://127.0.0.1:6080**
2. Attendre le boot complet (icône Play Store visible).
3. Installer le certificat MITM :
   ```bash
   ./scripts/install-mitm-cert.sh
   ```
4. Dans l'émulateur, ouvrir **Play Store**, se connecter, installer **سماء الروايات** (Sky Novel).
5. Ouvrir un roman, lire le **chapitre 51** (ou plus).
6. Vérifier les captures :
   ```bash
   ./scripts/show-captures.sh
   ```

Les requêtes sont enregistrées dans `captures/skynovel-flows.jsonl` (JSON ligne par ligne).

## Arrêt

```bash
./scripts/stop-capture.sh
```

## Installation du certificat MITM (détail)

Sans certificat, HTTPS ne passe pas dans mitmproxy (erreurs réseau dans l'app).

### Option A — Script automatique (root)

```bash
./scripts/install-mitm-cert.sh
```

### Option B — Installation manuelle (noVNC)

1. `./scripts/export-mitm-cert.sh`
2. Dans l'émulateur : **Paramètres → Sécurité → Chiffrement et identifiants**
3. **Installer un certificat → Certificat CA**
4. Choisir `mitmproxy-ca-cert.pem` (sur `/sdcard` si poussé par le script)

## Ce qu'il faut capturer

Lire un chapitre **51+** et repérer dans `skynovel-flows.jsonl` une entrée avec :

| Champ | Exemple attendu |
|-------|-----------------|
| `url` | `https://xxx/api/novels/.../chapters/51` |
| `request_headers` | `Authorization`, `X-...`, token Firebase |
| `response_body` | JSON avec le texte du chapitre |

**À partager pour implémenter la source** (sans données personnelles) :

- URL complète de l'endpoint chapitre
- Headers requis (sans ton token perso — régénérer un token guest si besoin)
- Extrait JSON de la réponse (1 chapitre)

## Commandes utiles

| Commande | Action |
|----------|--------|
| `./scripts/start-capture.sh` | Démarre stack + configure proxy ADB |
| `./scripts/setup-adb-proxy.sh` | Réapplique le proxy si besoin |
| `./scripts/clear-adb-proxy.sh` | Désactive le proxy |
| `./scripts/export-mitm-cert.sh` | Exporte le certificat mitmproxy |
| `./scripts/continue-capture.sh` | Workflow complet (stack + cert + Play Store) |
| `./scripts/open-cert-settings.sh` | Ouvre Paramètres → Sécurité pour le certificat |
| `./scripts/probe-realmnovel-api.mjs` | Sonde locale des routes API (liste fixe) |
| `./scripts/install-apk.sh apk/fichier.apk` | Installe un APK local |
| `./scripts/test-capture.sh` | Test navigateur + affiche captures |
| `docker compose logs -f mitmproxy` | Logs mitmproxy en direct |

## Dépannage

### ADB ne connecte pas

```bash
adb kill-server
adb start-server
adb connect 127.0.0.1:5555
adb devices
```

### L'émulateur est lent / ne boot pas

- Augmenter RAM Docker Desktop (8 GB+).
- Premier boot : 3–5 minutes.
- `docker compose logs -f android-emulator`

### L'app ne charge pas (erreur réseau)

- Certificat MITM non installé → réinstaller.
- Proxy non actif → `./scripts/setup-adb-proxy.sh`

### Certificat installé mais HTTPS échoue encore

L'app peut utiliser **certificate pinning**. Solutions :

1. **apk-mitm** — patcher l'APK pour désactiver le pinning :
   ```bash
   npx apk-mitm path/to/skynovel.apk
   adb install patched.apk
   ```
2. **Frida** — hook SSL (avancé, hors scope de ce guide).

### Aucune requête dans les captures

- Vérifier que mitmproxy tourne : `docker compose ps`
- Tester avec le navigateur de l'émulateur (http://mitm.it)
- Relire un chapitre 51+ dans Sky Novel

### Play Store absent

L'image budtmo inclut Play Store. Si absent, installer l'APK manuellement :

```bash
adb install skynovel.apk
```

APK depuis un miroir fiable ou extraction depuis un appareil personnel.

## Sécurité

- `captures/` contient des **tokens et données sensibles** — ne pas committer (`.gitignore` inclus).
- Utiliser uniquement pour analyser l'API de ton propre usage / intégration source.

## Suite (implémentation source)

Une fois l'endpoint identifié, créer `server/sources/skynovel.js` sur le modèle de `server/sources/nightnovel.js` et mapper :

- `novelId` MongoDB (identique au site `realmnovel.com`)
- `chapterNumber` → requête API → paragraphes

Partager le JSON capturé dans le chat pour l'implémentation.
