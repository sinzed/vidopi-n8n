#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXTENSION_STAGING="${REPO_ROOT}/.n8n-extension-staging"

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

echo "Staging custom extension (package.json + dist only, no node_modules)..."
rm -rf "${EXTENSION_STAGING}"
mkdir -p "${EXTENSION_STAGING}"
cp "${REPO_ROOT}/package.json" "${EXTENSION_STAGING}/"
cp -r "${DIST_DIR}" "${EXTENSION_STAGING}/"
if [ -f "${REPO_ROOT}/logo.svg" ]; then
  cp "${REPO_ROOT}/logo.svg" "${EXTENSION_STAGING}/"
fi

if [ -n "${N8N_CUSTOM_EXTENSIONS:-}" ]; then
  export N8N_CUSTOM_EXTENSIONS="${EXTENSION_STAGING}:${N8N_CUSTOM_EXTENSIONS}"
else
  export N8N_CUSTOM_EXTENSIONS="${EXTENSION_STAGING}"
fi

echo "Custom extensions path: ${N8N_CUSTOM_EXTENSIONS}"

export DB_SQLITE_POOL_SIZE="${DB_SQLITE_POOL_SIZE:-1}"
export N8N_RUNNERS_ENABLED="${N8N_RUNNERS_ENABLED:-true}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE="${N8N_BLOCK_ENV_ACCESS_IN_NODE:-false}"
export N8N_GIT_NODE_DISABLE_BARE_REPOS="${N8N_GIT_NODE_DISABLE_BARE_REPOS:-true}"

resolve_n8n_bin() {
  if [ -n "${N8N_BIN:-}" ] && [ -x "${N8N_BIN}" ]; then
    echo "${N8N_BIN}"
    return
  fi
  if [ -x "${REPO_ROOT}/node_modules/.bin/n8n" ]; then
    echo "${REPO_ROOT}/node_modules/.bin/n8n"
    return
  fi
  local pnpm_n8n="${HOME}/.local/share/pnpm/nodejs/24.11.1/bin/n8n"
  if [ -x "${pnpm_n8n}" ]; then
    echo "${pnpm_n8n}"
    return
  fi
  command -v n8n || true
}

N8N_BIN="$(resolve_n8n_bin)"
if [ -z "${N8N_BIN}" ]; then
  echo "ERROR: n8n not found. Run: npm install  (installs n8n devDependency)" >&2
  echo "       Or set N8N_BIN to your n8n binary." >&2
  exit 1
fi

N8N_VERSION="$("${N8N_BIN}" --version 2>/dev/null || echo unknown)"
echo "Using n8n ${N8N_VERSION} (${N8N_BIN})"

major="${N8N_VERSION%%.*}"
if [ "${major}" = "1" ] || [ "${N8N_VERSION}" = "unknown" ]; then
  echo "ERROR: n8n ${N8N_VERSION} is too old for this project." >&2
  echo "  Your shell PATH may point at nvm's global n8n while npm -g installed elsewhere." >&2
  echo "  Fix options:" >&2
  echo "    1) npm install   (uses local node_modules/n8n from devDependency)" >&2
  echo "    2) N8N_BIN=${HOME}/.local/share/pnpm/nodejs/24.11.1/bin/n8n ./scripts/start-n8n-with-vidopi.sh" >&2
  echo "    3) nvm's npm: $(command -v npm 2>/dev/null || echo npm) install -g n8n@latest" >&2
  exit 1
fi

exec "${N8N_BIN}" start "$@"
