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

show_usage() {
  echo "Usage: ./scripts/release.sh <service> <version> [options]"
  echo ""
  echo "Services:"
  echo "  db, postgres    - PostgreSQL 18 with pgvector + pg_textsearch"
  echo ""
  echo "Options:"
  echo "  --dry-run        Show what would be built without executing"
  echo ""
  echo "Examples:"
  echo "  ./scripts/release.sh db 0.1.0"
  echo "  ./scripts/release.sh db 0.1.0 --dry-run"
}

# Parse flags
DRY_RUN=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
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

case "$1" in
  db|postgres)
    SERVICE_NAME="PostgreSQL (pgvector + pg_textsearch)"
    declare -A DOCKER_BUILDS=(
      ["pg18-pg_textsearch"]="Dockerfile.pg"
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

# Build and push images
build_images() {
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
  gum style --foreground 245 "Cleaning up local images..."
  for package in "${!DOCKER_BUILDS[@]}"; do
    if [[ "$package" == "pg18-pg_textsearch" ]]; then
      image_tag="pg-$VERSION"
    else
      image_tag="i0-$VERSION"
    fi
    docker rmi "$REGISTRY/$REGISTRY_PATH/$package:$image_tag" 2>/dev/null || true
    docker rmi "$REGISTRY/$REGISTRY_PATH/$package:latest" 2>/dev/null || true
  done
  gum style --foreground 245 "Cleanup done."
}

# Set trap to cleanup on any exit
trap cleanup_local_images EXIT

echo ""
gum style --foreground 212 --bold "icons0 Release"
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
  gum style --foreground 214 "  [BUILD] $REGISTRY/$REGISTRY_PATH/$package:$image_tag"
done
echo ""

if ! gum confirm "Build and push images?"; then
  gum style --foreground 226 "Aborted."
  exit 0
fi

build_images

echo ""
gum style --foreground 82 --bold "✓ Pushed $SERVICE_NAME $VERSION"
