#!/bin/sh
# Démarrage du conteneur : applique les migrations, seed (optionnel), lance Next.
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "✖ DATABASE_URL n'est pas définie. Renseignez-la dans la config du service." >&2
  exit 1
fi

# Dans un conteneur, localhost = le conteneur lui-même, pas votre base de données.
case "$DATABASE_URL" in
  *@localhost:* | *@127.0.0.1:*)
    echo "⚠ DATABASE_URL pointe vers localhost/127.0.0.1." >&2
    echo "  Dans un conteneur, cela désigne le conteneur lui-même, PAS votre base." >&2
    echo "  Utilisez le nom d'hôte du service de base (ex. 'db' via docker compose," >&2
    echo "  ou l'hôte interne fourni par votre hébergeur/Dokploy)." >&2
    ;;
esac

echo "▶ Application des migrations Prisma…"
# La base peut mettre quelques secondes à accepter les connexions même après le
# healthcheck : on retente quelques fois avant d'abandonner.
attempt=0
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 12 ]; then
    echo "✖ Base de données injoignable après plusieurs tentatives." >&2
    exit 1
  fi
  echo "  … base pas encore prête, nouvelle tentative dans 3s ($attempt/12)"
  sleep 3
done

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "▶ Seed de la base (idempotent)…"
  # Le seed ne doit jamais bloquer le démarrage s'il échoue partiellement.
  npx prisma db seed || echo "⚠ Seed incomplet — l'application démarre quand même."
fi

echo "▶ Lancement de Next.js…"
exec npm run start
