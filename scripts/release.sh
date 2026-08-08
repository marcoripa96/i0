#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Registry configuration (set via env vars or .env)
if [[ -z "$REGISTRY" || -z "$REGISTRY_PATH" ]]; then
  echo -e "${RED}Error: REGISTRY and REGISTRY_PATH must be set${NC}"
  echo "  export REGISTRY=my-registry.example.com:5001"
  echo "  export REGISTRY_PATH=org/project"
  exit 1
fi

# Abort the release if schema.ts has changes that no migration covers.
#
# This is the failure that shipped card #285: two indexes were added to
# schema.ts and applied with `drizzle-kit push`, so `drizzle/` no longer built a
# working database and nobody noticed until someone asked. `drizzle-kit
# generate` writing a file here means exactly that drift.
#
# Generates into a scratch directory seeded with the real `drizzle/meta`, so the
# comparison is against recorded migration state without touching it. The
# DATABASE_URL is a dummy: generate diffs snapshots and never connects, and the
# timeout catches it if a future version tries to.
check_pending_migrations() {
  echo -e "${BLUE}Checking for pending database migrations...${NC}"

  local check_dir=".migration-check"
  rm -rf "$check_dir"
  mkdir -p "$check_dir"
  cp -r drizzle/meta "$check_dir/meta"

  local gen_exit=0
  timeout 30 env DATABASE_URL="postgresql://check@localhost/check" \
    bunx drizzle-kit generate --schema ./src/lib/db/schema.ts --dialect postgresql \
    --out "$check_dir" < /dev/null > /dev/null 2>&1 || gen_exit=$?

  local has_pending=false
  if ls "$check_dir"/*.sql > /dev/null 2>&1; then
    has_pending=true
  elif [[ "$gen_exit" -ne 0 ]]; then
    # A generate that cannot run is not proof of a clean schema.
    has_pending=true
  fi

  rm -rf "$check_dir"

  if [[ "$has_pending" = true ]]; then
    echo -e "${RED}ERROR: Schema has changes without a corresponding migration.${NC}"
    echo "Run: bun run db:generate"
    exit 1
  fi

  echo -e "${GREEN}Schema is in sync with migrations.${NC}"
}

show_usage() {
  echo "Usage: ./scripts/release.sh <service> <version> [options]"
  echo ""
  echo "Services:"
  echo "  db, postgres    - PostgreSQL 18 with pgvector + pg_textsearch"
  echo "  migrate         - Drizzle migrator, applies drizzle/ and exits"
  echo "  seed            - Database seeder, populates an empty database"
  echo ""
  echo "Options:"
  echo "  --dry-run        Show what would be built without executing"
  echo "  --yes, -y        Skip the confirmation prompt (required to run unattended)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/release.sh db 0.1.0"
  echo "  ./scripts/release.sh db 0.1.0 --dry-run"
  echo "  ./scripts/release.sh db 0.1.0 --yes    # CI, agents, anything without a terminal"
}

# Parse flags
DRY_RUN=false
ASSUME_YES=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes|-y)
      ASSUME_YES=true
      shift
      ;;
    -h|--help|help)
      show_usage
      exit 0
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

# Restore positional arguments
set -- "${POSITIONAL_ARGS[@]}"

# The progress display repaints itself with tput and reads a prompt with gum,
# neither of which means anything without a terminal: run from CI or an agent it
# writes escape codes into a log and blocks on a confirmation nobody can answer.
# So the script picks its output style from what it is actually attached to,
# rather than assuming a human is watching.
INTERACTIVE=true
if [[ ! -t 1 ]] || ! command -v gum > /dev/null 2>&1; then
  INTERACTIVE=false
fi

# Every message goes through these, so there is one release flow with two
# renderings rather than two flows that can drift apart.
emit() { # emit <color> <text>
  if [[ "$INTERACTIVE" = true ]]; then gum style --foreground "$1" "$2"; else echo "$2"; fi
}

emit_bold() { # emit_bold <color> <text>
  if [[ "$INTERACTIVE" = true ]]; then gum style --foreground "$1" --bold "$2"; else echo "$2"; fi
}

# Without a terminal there is nobody to answer, and the safe reading of silence
# is no. --yes is how an unattended caller says it meant to push.
#
# 0 yes, 1 the human declined, 2 nobody could be asked. The caller has to tell
# those last two apart: a declined release is a success (nothing was meant to
# happen), but one that could not even ask is a failure, and exiting 0 there
# would report a push that never occurred.
confirm() { # confirm <question>
  if [[ "$ASSUME_YES" = true ]]; then
    echo "$1 yes (--yes)"
    return 0
  fi
  if [[ "$INTERACTIVE" = true ]]; then
    gum confirm "$1"
    return $?
  fi
  echo "Refusing to build and push unattended. Re-run with --yes." >&2
  return 2
}

case "$1" in
  db|postgres)
    SERVICE_NAME="PostgreSQL (pgvector + pg_textsearch)"
    declare -A DOCKER_BUILDS=(
      ["pg18-pg_textsearch"]="Dockerfile.pg"
    )
    ;;
  migrate)
    SERVICE_NAME="Drizzle migrator"
    declare -A DOCKER_BUILDS=(
      ["i0-migrate"]="Dockerfile.migrate"
    )
    ;;
  seed)
    SERVICE_NAME="Database seeder"
    declare -A DOCKER_BUILDS=(
      ["i0-seed"]="Dockerfile.seed"
    )
    ;;
  "")
    echo -e "${RED}Error: Service is required${NC}"
    echo ""
    show_usage
    exit 1
    ;;
  *)
    echo -e "${RED}Error: Unknown service '$1'${NC}"
    echo ""
    show_usage
    exit 1
    ;;
esac

VERSION="$2"
if [[ -z "$VERSION" ]]; then
  echo -e "${RED}Error: Version is required${NC}"
  echo ""
  show_usage
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "${RED}Error: Version must be semver (e.g., 1.0.0)${NC}"
  exit 1
fi

# Function to show dry run information
show_dry_run() {
  echo ""
  echo -e "${BLUE}DRY RUN MODE - No changes will be made${NC}"
  echo ""
  echo "Service: $SERVICE_NAME"
  echo "Version: $VERSION"
  echo ""
  echo "Images to build:"
  for package in "${!DOCKER_BUILDS[@]}"; do
    dockerfile="${DOCKER_BUILDS[$package]}"
    if [[ "$package" == "pg18-pg_textsearch" ]]; then
      image_tag="pg-$VERSION"
    else
      image_tag="i0-$VERSION"
    fi
    image_name="$REGISTRY/$REGISTRY_PATH/$package:$image_tag"
    echo "  - $image_name"
    echo "    Dockerfile: $dockerfile"
    echo ""
  done
}

if [[ "$DRY_RUN" = true ]]; then
  show_dry_run
  exit 0
fi

# Before anything is built or pushed. Applies to every service: releasing a
# database image against a schema that has no migration is the same bug.
check_pending_migrations

# Build and push images.
#
# Two renderings of the same work: the TUI repaints a live tail per image and is
# what you get at a terminal; the plain one streams the build output as it
# arrives, which is what a log wants. Both build the same tags and both fail the
# same way.
build_images() {
  if [[ "$INTERACTIVE" = true ]]; then
    build_images_tui
  else
    build_images_plain
  fi
}

# Sequential and unadorned. Builds are streamed rather than captured and printed
# at the end, so a multi-minute image build does not look like a hang.
build_images_plain() {
  local log_dir failed=()
  log_dir=$(mktemp -d)

  for package in "${!DOCKER_BUILDS[@]}"; do
    local dockerfile="${DOCKER_BUILDS[$package]}"
    local image_tag
    if [[ "$package" == "pg18-pg_textsearch" ]]; then
      image_tag="pg-$VERSION"
    else
      image_tag="i0-$VERSION"
    fi
    local image_name="$REGISTRY/$REGISTRY_PATH/$package:$image_tag"
    local image_latest="$REGISTRY/$REGISTRY_PATH/$package:latest"

    echo ""
    echo "==> $image_name"

    local rc=0
    set +e
    docker buildx build \
      --pull \
      --push \
      -t "$image_name" \
      -t "$image_latest" \
      -f "$dockerfile" . 2>&1 | tee "$log_dir/$package.log" | sed 's/^/    /'
    rc=${PIPESTATUS[0]}
    set -e

    if [[ "$rc" -ne 0 ]]; then
      echo "    FAILED (exit $rc)"
      failed+=("$package")
    else
      echo "    pushed $image_tag and latest"
    fi
  done

  rm -rf "$log_dir"

  if [[ ${#failed[@]} -gt 0 ]]; then
    echo ""
    echo "Build failed for: ${failed[*]}" >&2
    exit 1
  fi

  echo ""
  echo "✓ All images built and pushed successfully!"
}

build_images_tui() {
  local log_dir
  log_dir=$(mktemp -d)

  local pids=()
  local packages_arr=()

  for package in "${!DOCKER_BUILDS[@]}"; do
    packages_arr+=("$package")
  done

  local num_packages=${#packages_arr[@]}
  local log_lines_count=8
  local lines_per_package=$((log_lines_count + 2))

  # Hide cursor during updates
  tput civis

  trap 'tput cnorm; rm -rf "$log_dir"; exit 130' INT TERM

  clear
  gum style --foreground 212 --bold "Building and pushing images..."
  echo ""

  # Reserve space for all packages
  local total_lines=$((num_packages * lines_per_package))
  for ((i = 0; i < total_lines; i++)); do
    echo ""
  done

  # Start all builds in parallel
  for package in "${packages_arr[@]}"; do
    dockerfile="${DOCKER_BUILDS[$package]}"
    if [[ "$package" == "pg18-pg_textsearch" ]]; then
      image_tag="pg-$VERSION"
    else
      image_tag="i0-$VERSION"
    fi
    image_name="$REGISTRY/$REGISTRY_PATH/$package:$image_tag"
    image_latest="$REGISTRY/$REGISTRY_PATH/$package:latest"

    local log_file="$log_dir/$package.log"
    touch "$log_file"
    echo "PENDING" > "$log_file.status"

    (
      echo "STARTED" > "$log_file.status"
      if docker buildx build \
          --pull \
          --push \
          -t "$image_name" \
          -t "$image_latest" \
          -f "$dockerfile" . \
          >> "$log_file" 2>&1; then
        echo "SUCCESS" > "$log_file.status"
      else
        echo "FAILED" > "$log_file.status"
      fi
    ) &

    pids+=($!)
  done

  local base_row=2

  update_package_display() {
    local idx=$1
    local pkg=$2
    local status=$3
    local log_file="$log_dir/$pkg.log"
    local start_row=$((base_row + idx * lines_per_package))

    local icon color
    case "$status" in
      STARTED) icon="◐"; color="226" ;;
      SUCCESS) icon="✓"; color="82" ;;
      FAILED)  icon="✗"; color="196" ;;
      *)       icon="○"; color="245" ;;
    esac

    tput cup "$start_row" 0
    tput el
    gum style --foreground "$color" --bold "$icon $pkg"

    local log_lines=()
    if [[ -f "$log_file" ]]; then
      while IFS= read -r line; do
        log_lines+=("$line")
      done < <(tail -n "$log_lines_count" "$log_file" 2>/dev/null)
    fi

    local term_width
    term_width=$(tput cols)
    local max_len=$((term_width - 4))

    for ((j = 0; j < log_lines_count; j++)); do
      tput cup "$((start_row + 1 + j))" 0
      tput el
      if [[ $j -lt ${#log_lines[@]} ]]; then
        local log_line="${log_lines[$j]}"
        if [[ ${#log_line} -gt $max_len ]]; then
          log_line="${log_line:0:$max_len}"
        fi
        printf "  \033[0;90m%s\033[0m" "$log_line"
      fi
    done
  }

  # Monitor build progress
  local all_done=false
  while [[ "$all_done" = false ]]; do
    all_done=true

    for i in "${!packages_arr[@]}"; do
      local pkg="${packages_arr[$i]}"
      local status_file="$log_dir/$pkg.log.status"
      local status="PENDING"

      if [[ -f "$status_file" ]]; then
        status=$(cat "$status_file")
      fi

      if [[ "$status" == "STARTED" || "$status" == "PENDING" ]]; then
        all_done=false
      fi

      update_package_display "$i" "$pkg" "$status"
    done

    if [[ "$all_done" = false ]]; then
      sleep 0.3
    fi
  done

  local final_row=$((base_row + num_packages * lines_per_package))
  tput cup "$final_row" 0
  tput cnorm

  # Check for failures
  local failed=false
  local failed_packages=()
  for pkg in "${packages_arr[@]}"; do
    local status_file="$log_dir/$pkg.log.status"
    if [[ "$(cat "$status_file")" = "FAILED" ]]; then
      failed=true
      failed_packages+=("$pkg")
    fi
  done

  echo ""
  if [[ "$failed" = true ]]; then
    gum style --foreground 196 --bold "Build failed for: ${failed_packages[*]}"
    echo ""
    for pkg in "${failed_packages[@]}"; do
      if gum confirm "Show full $pkg logs?"; then
        gum pager < "$log_dir/$pkg.log"
      fi
    done
    rm -rf "$log_dir"
    exit 1
  fi

  rm -rf "$log_dir"
  gum style --foreground 82 --bold "✓ All images built and pushed successfully!"
}

# Cleanup function to remove local images
cleanup_local_images() {
  echo ""
  emit 245 "Cleaning up local images..."
  for package in "${!DOCKER_BUILDS[@]}"; do
    if [[ "$package" == "pg18-pg_textsearch" ]]; then
      image_tag="pg-$VERSION"
    else
      image_tag="i0-$VERSION"
    fi
    docker rmi "$REGISTRY/$REGISTRY_PATH/$package:$image_tag" 2>/dev/null || true
    docker rmi "$REGISTRY/$REGISTRY_PATH/$package:latest" 2>/dev/null || true
  done
  emit 245 "Cleanup done."
}

# Set trap to cleanup on any exit
trap cleanup_local_images EXIT

echo ""
emit_bold 212 "icons0 Release"
echo ""
echo "Service: $SERVICE_NAME"
echo "Version: $VERSION"
echo ""

echo "Images to build:"
for package in "${!DOCKER_BUILDS[@]}"; do
  if [[ "$package" == "pg18-pg_textsearch" ]]; then
    image_tag="pg-$VERSION"
  else
    image_tag="i0-$VERSION"
  fi
  emit 214 "  [BUILD] $REGISTRY/$REGISTRY_PATH/$package:$image_tag"
done
echo ""

confirm "Build and push images?" || confirm_rc=$?
if [[ "${confirm_rc:-0}" -ne 0 ]]; then
  emit 226 "Aborted."
  exit $(( confirm_rc == 2 ? 1 : 0 ))
fi

build_images

echo ""
emit_bold 82 "✓ Pushed $SERVICE_NAME $VERSION"
