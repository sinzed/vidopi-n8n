#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Preparing Vidopi n8n custom nodes in ${REPO_ROOT}"

cd "${REPO_ROOT}"

CONFIG_FILE="${HOME}/.n8n/config"
if [ -f "${CONFIG_FILE}" ]; then
  chmod 600 "${CONFIG_FILE}" 2>/dev/null || true
fi

if [ ! -d "${REPO_ROOT}/node_modules" ]; then
  echo "node_modules missing; running npm install..."
  npm install
fi

echo "Building TypeScript sources..."
npm run build

DIST_DIR="${REPO_ROOT}/dist"

if [ ! -d "${DIST_DIR}/nodes" ]; then
  echo "ERROR: Built nodes not found in ${DIST_DIR}/nodes. Did the build succeed?" >&2
  exit 1
fi

if [ -n "${N8N_CUSTOM_EXTENSIONS:-}" ]; then
  export N8N_CUSTOM_EXTENSIONS="${REPO_ROOT}:${N8N_CUSTOM_EXTENSIONS}"
else
  export N8N_CUSTOM_EXTENSIONS="${REPO_ROOT}"
fi

echo "Starting n8n with custom extensions from ${N8N_CUSTOM_EXTENSIONS}"

export DB_SQLITE_POOL_SIZE="${DB_SQLITE_POOL_SIZE:-1}"
export N8N_RUNNERS_ENABLED="${N8N_RUNNERS_ENABLED:-true}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE="${N8N_BLOCK_ENV_ACCESS_IN_NODE:-false}"
export N8N_GIT_NODE_DISABLE_BARE_REPOS="${N8N_GIT_NODE_DISABLE_BARE_REPOS:-true}"

exec n8n start "$@"

