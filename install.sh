#!/usr/bin/env bash
# Installation en une commande : dépendances puis configuration guidée.
#   ./install.sh            installation interactive
#   ./install.sh --yes      valeurs par défaut (local), sans question
set -euo pipefail
cd "$(dirname "$0")"

echo "➤ Vérification de Node.js…"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 est requis : https://nodejs.org (ou nvm install 22)." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20.9+ requis (22 recommandé). Version détectée : $(node -v)." >&2
  exit 1
fi

echo "➤ Installation des dépendances (npm ci)…"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo "➤ Configuration guidée…"
npm run setup -- "$@"
