# Déploiement Docker — LSPD MDT

Tout le projet (application Next.js + base MariaDB) tourne en conteneurs, sans
XAMPP ni installation Node sur la machine hôte.

## Prérequis
- Docker Engine + Docker Compose v2 (`docker compose version`).

## Démarrage rapide
```bash
cd lspd-mdt
cp .env.docker.example .env      # puis éditez .env (mot de passe DB, Discord…)
docker compose up -d --build
```
L'application est disponible sur http://localhost:3080 (ou `APP_PORT`).

Au premier démarrage, le conteneur `app` :
1. attend que MariaDB soit prête (healthcheck) ;
2. applique **toutes les migrations** Prisma (`prisma migrate deploy`) — la base
   est reconstruite depuis zéro ;
3. lance le **seed** idempotent (grades, code pénal, comptes de départ…) si
   `SEED_ON_START=true` ;
4. démarre Next.js en mode production.

## Commandes utiles
```bash
docker compose logs -f app        # logs de l'application
docker compose ps                 # état des services
docker compose restart app        # redémarrer l'app
docker compose down               # arrêter (données conservées)
docker compose down -v            # arrêter ET tout effacer (base + uploads)
docker compose up -d --build      # reconstruire après une modif de code
```

## Persistance
- `db-data` : données MariaDB.
- `uploads` : images uploadées (preuves, chat) — montées sur
  `/app/public/uploads`.

Ces volumes survivent à `docker compose down` (mais pas à `down -v`).

## Configuration
Toute la config passe par le `.env` (voir `.env.docker.example`) :

| Variable | Rôle | Défaut |
|---|---|---|
| `DB_PASSWORD` | mot de passe root MariaDB | `lspd_root` |
| `DB_NAME` | nom de la base | `lspd_mdt` |
| `APP_PORT` | port exposé sur l'hôte | `3080` |
| `APP_URL` | URL publique (redirections, Discord) | `http://localhost:3080` |
| `SEED_ON_START` | rejoue le seed au démarrage | `true` |
| `DISCORD_*` | connexion Discord (optionnelle) | vide |

> `DATABASE_URL` est construite automatiquement par le compose vers le service
> `db` : ne la définissez pas dans `.env`.

## Mise à jour après un changement de schéma
Créez normalement votre migration Prisma (fichier dans `prisma/migrations/`),
puis :
```bash
docker compose up -d --build
```
`prisma migrate deploy` appliquera la nouvelle migration au démarrage.

## Notes
- Prisma 7 utilise l'adaptateur MariaDB (pas de moteur natif) : la connexion se
  fait via `mysql://…@db:3306/…`.
- Passez `SEED_ON_START=false` une fois l'installation faite pour accélérer les
  redémarrages.
- En production, changez `DB_PASSWORD` et servez le site derrière HTTPS
  (reverse proxy) en ajustant `APP_URL`.
