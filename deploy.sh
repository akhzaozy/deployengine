#!/usr/bin/env bash
# ==============================================================================
# AutoDeploy Engine - Universal Deployment Automation Script
# Versi        : 4.1.0
# Target OS    : Linux (aaPanel / Ubuntu / Debian / CentOS / macOS dev)
# PHP Runtime  : PHP 8.4 Locked (/www/server/php/84/bin/php)
# ==============================================================================

set -eo pipefail

# Warna Output Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper Logging
log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${BLUE}================================================================${NC}"; echo -e "${BOLD}${CYAN}$1${NC}"; echo -e "${BOLD}${BLUE}================================================================${NC}"; }

# Periksa Argumen Input
INPUT_REPO="$1"
INPUT_BRANCH="${2:-}"
TARGET_DIR_OVERRIDE="${3:-}"

if [ -z "$INPUT_REPO" ]; then
  echo -e "${BOLD}AutoDeploy Universal Script - Panduan Penggunaan:${NC}"
  echo -e "  bash deploy.sh <URL-GitHub | username/repo | nama-slug> [branch] [target-dir]"
  echo -e ""
  echo -e "Contoh Input:"
  echo -e "  1. Full HTTPS URL : bash deploy.sh https://github.com/laravel/laravel.git"
  echo -e "  2. Format Singkat : bash deploy.sh user/portal-akademik main"
  echo -e "  3. SSH URL        : bash deploy.sh git@github.com:user/ecommerce.git"
  echo -e ""
  exit 1
fi

# ==============================================================================
# RESOLUSI RUNTIME & ENVIRONMENT (PHP 8.4 LOCKED)
# ==============================================================================
# Prioritaskan binary PHP 8.4 aaPanel
if [ -x "/www/server/php/84/bin/php" ]; then
  PHP_BIN="/www/server/php/84/bin/php"
elif command -v php >/dev/null 2>&1; then
  PHP_BIN="$(command -v php)"
else
  log_error "PHP binary tidak ditemukan di /www/server/php/84/bin/php atau PATH sistem!"
  exit 1
fi

# Prioritaskan Composer binary
if [ -x "/usr/local/bin/composer" ]; then
  COMPOSER_BIN="/usr/local/bin/composer"
elif command -v composer >/dev/null 2>&1; then
  COMPOSER_BIN="$(command -v composer)"
else
  COMPOSER_BIN="/usr/local/bin/composer"
fi

# Base Directory & Web User (aaPanel: www:www)
if [ -d "/www/server" ] && [ "$(uname -s)" = "Linux" ]; then
  DEFAULT_BASE_DIR="/www/wwwroot/hosting"
  WEB_USER="www"
  WEB_GROUP="www"
else
  DEFAULT_BASE_DIR="${HOME}/.autodeploy/projects"
  WEB_USER="$(id -un)"
  WEB_GROUP="$(id -gn)"
fi

BASE_DIR="${AUTODEPLOY_BASE_DIR:-$DEFAULT_BASE_DIR}"

# ==============================================================================
# PARSING UNIVERSAL REPOSITORY INPUT
# ==============================================================================
GIT_URL=""
REPO_NAME=""

# Bersihkan input dari spasi
CLEAN_INPUT="$(echo "$INPUT_REPO" | xargs)"

if [[ "$CLEAN_INPUT" =~ ^git@ ]]; then
  # SSH: git@github.com:user/repo.git
  GIT_URL="$CLEAN_INPUT"
  REPO_NAME="$(basename "$CLEAN_INPUT" .git)"
elif [[ "$CLEAN_INPUT" =~ ^https?:// ]]; then
  # HTTPS: https://github.com/user/repo(.git)
  GIT_URL="$CLEAN_INPUT"
  if [[ ! "$GIT_URL" =~ \.git$ ]]; then
    GIT_URL="${GIT_URL}.git"
  fi
  REPO_NAME="$(basename "$CLEAN_INPUT" .git)"
elif [[ "$CLEAN_INPUT" == *"/"* ]]; then
  # Format Singkat: username/repo
  REPO_NAME="$(echo "$CLEAN_INPUT" | awk -F'/' '{print $NF}' | sed 's/\.git$//')"
  GIT_URL="https://github.com/${CLEAN_INPUT%.git}.git"
else
  # Slug murni tanpa slash
  REPO_NAME="$CLEAN_INPUT"
fi

# Bersihkan REPO_NAME hanya mengizinkan alfanumerik dan tanda hubung
REPO_SLUG="$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')"

if [ -n "$TARGET_DIR_OVERRIDE" ]; then
  PROJECT_DIR="$TARGET_DIR_OVERRIDE"
else
  PROJECT_DIR="${BASE_DIR}/${REPO_SLUG}"
fi

echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  AUTODEPLOY ENGINE v4.1 - UNIVERSAL CI/CD PIPELINE${NC}"
echo -e "  Repo Slug       : ${BOLD}${REPO_SLUG}${NC}"
echo -e "  Git URL         : ${GIT_URL:-<Local Workspace>}"
echo -e "  Target Dir      : ${PROJECT_DIR}"
echo -e "  PHP Runtime     : ${PHP_BIN} ($($PHP_BIN -r 'echo PHP_VERSION;' 2>/dev/null || echo 'Unknown'))"
echo -e "  Ownership       : ${WEB_USER}:${WEB_GROUP}"
echo -e "${BOLD}${GREEN}================================================================${NC}"

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# ==============================================================================
# [STEP 1/6] Penanganan Git & Universal Repository Input
# ==============================================================================
log_step "[STEP 1/6] Penanganan Git & Universal Repository Input"

# 1. Eksekusi git safe.directory secara global untuk mencegah fatal dubious ownership
log_info "Mengonfigurasi git safe.directory '* global'..."
git config --global --add safe.directory '*' || true

# 2. Deteksi default branch repositori secara dinamis (main vs master)
TARGET_BRANCH="$INPUT_BRANCH"

if [ -z "$TARGET_BRANCH" ] && [ -n "$GIT_URL" ]; then
  log_info "Mendeteksi default branch remote repositori..."
  DETECTED_REF="$(git ls-remote --symref "$GIT_URL" HEAD 2>/dev/null | grep 'ref:' | head -n1 || true)"
  if [[ "$DETECTED_REF" =~ refs/heads/([^[:space:]]+) ]]; then
    TARGET_BRANCH="${BASH_REMATCH[1]}"
    log_info "Branch default terdeteksi: '${TARGET_BRANCH}'"
  else
    TARGET_BRANCH="main"
  fi
elif [ -z "$TARGET_BRANCH" ]; then
  TARGET_BRANCH="main"
fi

# 3. Sinkronisasi branch atau clone baru
if [ -d ".git" ]; then
  log_info "Direktori git terdeteksi. Menyinkronkan branch '${TARGET_BRANCH}'..."
  if ! git fetch origin "$TARGET_BRANCH" 2>/dev/null && [ "$TARGET_BRANCH" = "main" ]; then
    log_warn "Branch 'main' tidak ditemukan di remote, mencoba fallback ke 'master'..."
    TARGET_BRANCH="master"
    git fetch origin "$TARGET_BRANCH"
  else
    git fetch origin "$TARGET_BRANCH"
  fi
  git reset --hard "origin/${TARGET_BRANCH}"
  git clean -df
  log_success "Source code berhasil disinkronkan ke commit: $(git rev-parse --short HEAD)"
elif [ -n "$GIT_URL" ]; then
  EXISTING_ITEMS="$(ls -A "$PROJECT_DIR" 2>/dev/null | grep -v '^\.git$' || true)"
  if [ -z "$EXISTING_ITEMS" ]; then
    log_info "Meng-clone repositori dari ${GIT_URL} (Branch: ${TARGET_BRANCH})..."
    if ! git clone --depth 1 -b "$TARGET_BRANCH" "$GIT_URL" . 2>/dev/null; then
      FALLBACK_BRANCH="master"
      [ "$TARGET_BRANCH" = "master" ] && FALLBACK_BRANCH="main"
      log_warn "Clone branch '${TARGET_BRANCH}' gagal, mencoba fallback branch '${FALLBACK_BRANCH}'..."
      if ! git clone --depth 1 -b "$FALLBACK_BRANCH" "$GIT_URL" .; then
        log_error "FATAL: Gagal melakukan git clone untuk repositori ${GIT_URL}. Proses dihentikan!"
        exit 1
      fi
      TARGET_BRANCH="$FALLBACK_BRANCH"
    fi
    log_success "Git clone berhasil (Branch: ${TARGET_BRANCH}, Commit: $(git rev-parse --short HEAD))"
  else
    log_info "Direktori sudah berisi file. Menginisialisasi git origin..."
    git init
    git remote remove origin 2>/dev/null || true
    git remote add origin "$GIT_URL"
    if ! git fetch --depth 1 origin "$TARGET_BRANCH" 2>/dev/null; then
      TARGET_BRANCH="master"
      git fetch --depth 1 origin "$TARGET_BRANCH"
    fi
    git checkout -f -B "$TARGET_BRANCH" "origin/${TARGET_BRANCH}"
    log_success "Git diinisialisasi dan berhasil checkout."
  fi
else
  log_info "Menggunakan file repositori lokal yang ada."
fi

# ==============================================================================
# [STEP 2/6] Setup Environment (.env) & Konfigurasi
# ==============================================================================
log_step "[STEP 2/6] Setup Environment (.env) & Konfigurasi"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    log_info "Menyalin file .env dari template .env.example..."
    cp -f .env.example .env
    log_success "File .env berhasil dibuat dari .env.example."
  else
    log_warn ".env.example tidak ditemukan. Membuat file .env kosong..."
    touch .env
  fi
else
  log_info "File .env sudah ada, mempertahankan konfigurasi lingkungan yang aktif."
fi

# ==============================================================================
# [STEP 3/6] Penanganan Dependensi & Environment (PHP 8.4 & Composer)
# ==============================================================================
log_step "[STEP 3/6] Penanganan Dependensi & Environment (PHP 8.4 & Composer)"

# Wajib export COMPOSER_ALLOW_SUPERUSER=1 sebelum mengeksekusi Composer
export COMPOSER_ALLOW_SUPERUSER=1

if [ -f "artisan" ] || [ -f "composer.json" ]; then
  log_info "Mengeksekusi Composer dengan PHP 8.4: ${PHP_BIN} ${COMPOSER_BIN}..."
  
  # Jalankan Composer menggunakan PHP 8.4
  if ! "$PHP_BIN" "$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction; then
    log_warn "'composer install' gagal. Mencoba fallback dengan flag '--ignore-platform-req=php+'..."
    if ! "$PHP_BIN" "$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction --ignore-platform-req=php+; then
      log_warn "Fallback install gagal. Mencoba 'composer update --no-dev'..."
      "$PHP_BIN" "$COMPOSER_BIN" update --no-dev --optimize-autoloader --no-interaction --ignore-platform-req=php+ || true
    fi
  fi

  if [ ! -f "vendor/autoload.php" ]; then
    log_error "FATAL: File 'vendor/autoload.php' tidak ditemukan setelah composer install/update! Dependensi gagal terpasang."
    exit 1
  fi
  log_success "Dependensi Composer berhasil diinstal."
fi

# Next.js / Node.js
if [ -f "package.json" ] && [ ! -f "artisan" ]; then
  log_info "Mendeteksi project Node.js / Next.js. Menginstal node modules..."
  npm install --prefer-offline || npm install
  log_success "Dependensi npm berhasil diinstal."
fi

# ==============================================================================
# [STEP 4/6] Pipeline Framework (Laravel & Framework Lain)
# ==============================================================================
log_step "[STEP 4/6] Pipeline Framework (Laravel & Framework Lain)"

if [ -f "artisan" ]; then
  log_info "Mendeteksi framework Laravel. Menjalankan alur artisan..."

  # 1. Cek APP_KEY di .env. Generate hanya jika kosong atau belum ada nilai.
  APP_KEY_VAL="$(grep -E '^APP_KEY=' .env 2>/dev/null | cut -d '=' -f2- | xargs || true)"
  if [ -z "$APP_KEY_VAL" ]; then
    log_info "APP_KEY di .env masih kosong. Menjalankan 'artisan key:generate --force'..."
    "$PHP_BIN" artisan key:generate --force
    log_success "APP_KEY baru berhasil dibuat."
  else
    log_info "APP_KEY sudah terisi (${APP_KEY_VAL:0:12}...). Melewati key:generate."
  fi

  # 2. Jalankan storage:link --force
  log_info "Menautkan storage public link (php artisan storage:link --force)..."
  "$PHP_BIN" artisan storage:link --force || true

  # 3. Jalankan database migration dengan penanganan error anggun (graceful)
  log_info "Menjalankan migrasi database (php artisan migrate --force)..."
  if "$PHP_BIN" artisan migrate --force 2>&1; then
    log_success "Migrasi database berhasil dieksekusi."
  else
    log_warn "'php artisan migrate --force' gagal atau database belum terhubung. Deployment tetap dilanjutkan tanpa mematikan alur."
  fi

  # 4. Bersihkan cache: php artisan optimize:clear
  log_info "Membersihkan seluruh cache aplikasi (php artisan optimize:clear)..."
  "$PHP_BIN" artisan optimize:clear
  log_success "Cache Laravel berhasil dibersihkan."
elif [ -f "package.json" ] && [ -f "next.config.js" -o -f "next.config.mjs" -o -f "next.config.ts" ]; then
  log_info "Menjalankan Next.js build..."
  npm run build
  log_success "Next.js build selesai."
fi

# ==============================================================================
# [STEP 5/6] Izin Akses File (Permissions & Ownership: www:www)
# ==============================================================================
log_step "[STEP 5/6] Izin Akses File (Permissions & Ownership: www:www)"

log_info "Mengatur kepemilikan direktori ke '${WEB_USER}:${WEB_GROUP}'..."
if [ "$(id -u)" -eq 0 ]; then
  chown -R "${WEB_USER}:${WEB_GROUP}" "$PROJECT_DIR" 2>/dev/null || true
else
  log_warn "Menjalankan bukan sebagai root; chown diabaikan atau dijalankan dengan izin saat ini."
fi

log_info "Mengatur hak akses direktori (755) dan file (644)..."
find "$PROJECT_DIR" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$PROJECT_DIR" -type f -exec chmod 644 {} + 2>/dev/null || true

# Khusus folder writable pada Laravel (storage & bootstrap/cache)
if [ -f "artisan" ]; then
  log_info "Mengatur izin 775 untuk direktori writable (storage & bootstrap/cache)..."
  mkdir -p "$PROJECT_DIR/storage" "$PROJECT_DIR/bootstrap/cache"
  chmod -R 775 "$PROJECT_DIR/storage" "$PROJECT_DIR/bootstrap/cache" 2>/dev/null || true
  if [ "$(id -u)" -eq 0 ]; then
    chown -R "${WEB_USER}:${WEB_GROUP}" "$PROJECT_DIR/storage" "$PROJECT_DIR/bootstrap/cache" 2>/dev/null || true
  fi
fi

# File .env aman (640)
if [ -f "$PROJECT_DIR/.env" ]; then
  chmod 640 "$PROJECT_DIR/.env" 2>/dev/null || true
  if [ "$(id -u)" -eq 0 ]; then
    chown "${WEB_USER}:${WEB_GROUP}" "$PROJECT_DIR/.env" 2>/dev/null || true
  fi
fi

log_success "Hak akses file dan direktori berhasil dikonfigurasi secara aman."

# ==============================================================================
# [STEP 6/6] Selesai & Ringkasan Deployment
# ==============================================================================
log_step "[STEP 6/6] Selesai & Ringkasan Deployment"

echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  AUTOMATION PIPELINE DEPLOYMENT SELESAI DENGAN SUKSES!${NC}"
echo -e "  Repo Slug       : ${BOLD}${REPO_SLUG}${NC}"
echo -e "  Direktori       : ${PROJECT_DIR}"
echo -e "  Runtime PHP     : PHP 8.4 (${PHP_BIN})"
echo -e "  Hak Akses       : ${WEB_USER}:${WEB_GROUP} (Dir: 755, File: 644, Writable: 775)"
echo -e "${BOLD}${GREEN}================================================================${NC}"
