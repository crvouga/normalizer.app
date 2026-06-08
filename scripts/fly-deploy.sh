#!/usr/bin/env bash
set -euo pipefail

# Idempotent Fly provisioning + deploy for CI.
# Requires: FLY_API_TOKEN, VAULT_TOKEN, CLOUDFLARE_API_TOKEN
# Optional: FLY_ORG (default: personal), FLY_ZONE_DOMAIN (default: normalizer.app),
#           FLY_PRIMARY_HOST (default: parsed from fly.toml SERVER_BASE_URL),
#           CLOUDFLARE_ZONE_ID (auto-resolved from zone domain)

APP_NAME="$(grep -E '^app = ' fly.toml | sed -E 's/^app = "(.*)"/\1/')"
ORG="${FLY_ORG:-personal}"
PRIMARY_HOST="${FLY_PRIMARY_HOST:-$(grep 'SERVER_BASE_URL' fly.toml | sed -E 's|.*"https?://([^"]+)".*|\1|')}"
ZONE_DOMAIN="${FLY_ZONE_DOMAIN:-normalizer.app}"
APEX_HOST="${ZONE_DOMAIN}"

require_env() {
  local name=$1
  if [[ -z "${!name:-}" ]]; then
    echo "Error: $name is required (store it in secret/personal/prd)" >&2
    exit 1
  fi
}

log() {
  echo "==> $*"
}

cf_api() {
  local method=$1
  local path=$2
  shift 2
  curl -sS -X "$method" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4${path}" \
    "$@"
}

cf_assert_success() {
  local response=$1
  local context=$2
  if [[ "$(echo "$response" | jq -r '.success')" != "true" ]]; then
    echo "Cloudflare API error ($context): $(echo "$response" | jq -c '.errors')" >&2
    exit 1
  fi
}

cloudflare_zone_id() {
  if [[ -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
    echo "$CLOUDFLARE_ZONE_ID"
    return
  fi

  local response
  response="$(cf_api GET "/zones?name=${ZONE_DOMAIN}&status=active")"
  cf_assert_success "$response" "zone lookup for ${ZONE_DOMAIN}"

  local zone_id
  zone_id="$(echo "$response" | jq -r '.result[0].id // empty')"
  if [[ -z "$zone_id" ]]; then
    echo "Error: no active Cloudflare zone found for ${ZONE_DOMAIN}" >&2
    exit 1
  fi
  echo "$zone_id"
}

upsert_dns_record() {
  local zone_id=$1
  local type=$2
  local name=$3
  local content=$4
  local proxied=${5:-false}

  local response record_id existing_content existing_proxied
  response="$(cf_api GET "/zones/${zone_id}/dns_records?type=${type}&name=${name}&per_page=1")"
  cf_assert_success "$response" "list ${type} ${name}"

  record_id="$(echo "$response" | jq -r '.result[0].id // empty')"
  existing_content="$(echo "$response" | jq -r '.result[0].content // empty')"
  existing_proxied="$(echo "$response" | jq -r '.result[0].proxied // false')"

  if [[ -n "$record_id" && "$existing_content" == "$content" && "$existing_proxied" == "$proxied" ]]; then
    log "DNS ${type} ${name} already points to ${content} (proxied=${proxied})"
    return 0
  fi

  local payload
  payload="$(jq -n \
    --arg type "$type" \
    --arg name "$name" \
    --arg content "$content" \
    --argjson proxied "$proxied" \
    '{type: $type, name: $name, content: $content, proxied: $proxied, ttl: 1}')"

  if [[ -n "$record_id" ]]; then
    log "Updating DNS ${type} ${name} -> ${content} (proxied=${proxied})"
    response="$(cf_api PATCH "/zones/${zone_id}/dns_records/${record_id}" -d "$payload")"
  else
    log "Creating DNS ${type} ${name} -> ${content} (proxied=${proxied})"
    response="$(cf_api POST "/zones/${zone_id}/dns_records" -d "$payload")"
  fi
  cf_assert_success "$response" "upsert ${type} ${name}"
}

ensure_app() {
  if flyctl apps list --json | jq -e --arg name "$APP_NAME" '.[] | select(.Name == $name)' >/dev/null; then
    log "Fly app ${APP_NAME} exists"
    return 0
  fi

  log "Creating Fly app ${APP_NAME} in org ${ORG}"
  flyctl apps create "$APP_NAME" --org "$ORG"
}

ensure_ips() {
  local ips
  ips="$(flyctl ips list -a "$APP_NAME" --json)"

  if ! echo "$ips" | jq -e '.[] | select(.Type == "v6")' >/dev/null; then
    log "Allocating IPv6 for ${APP_NAME}"
    flyctl ips allocate-v6 -a "$APP_NAME"
    ips="$(flyctl ips list -a "$APP_NAME" --json)"
  fi

  if ! echo "$ips" | jq -e '.[] | select(.Type == "v4")' >/dev/null; then
    log "Allocating shared IPv4 for ${APP_NAME}"
    flyctl ips allocate-v4 --shared -a "$APP_NAME" -y
  fi
}

sync_runtime_secrets() {
  log "Syncing VAULT_TOKEN to Fly app ${APP_NAME}"
  flyctl secrets set "VAULT_TOKEN=${VAULT_TOKEN}" -a "$APP_NAME" --stage
}

ensure_certificate() {
  local host=$1
  if flyctl certs list -a "$APP_NAME" --json | jq -e --arg host "$host" '.[] | select(.hostname == $host)' >/dev/null; then
    log "TLS certificate for ${host} already requested"
    return 0
  fi

  log "Requesting TLS certificate for ${host}"
  flyctl certs add "$host" -a "$APP_NAME"
}

ensure_certificates() {
  ensure_certificate "$PRIMARY_HOST"
  ensure_certificate "$APEX_HOST"
}

sync_cloudflare_dns() {
  local zone_id v4 v6
  zone_id="$(cloudflare_zone_id)"

  v4="$(flyctl ips list -a "$APP_NAME" --json | jq -r '.[] | select(.Type == "v4") | .Address' | head -1)"
  v6="$(flyctl ips list -a "$APP_NAME" --json | jq -r '.[] | select(.Type == "v6") | .Address' | head -1)"

  if [[ -z "$v4" || -z "$v6" ]]; then
    echo "Error: Fly app ${APP_NAME} is missing public IPs after allocation" >&2
    exit 1
  fi

  log "Syncing Cloudflare DNS: ${PRIMARY_HOST} -> Fly (DNS-only)"
  upsert_dns_record "$zone_id" "A" "$PRIMARY_HOST" "$v4" false
  upsert_dns_record "$zone_id" "AAAA" "$PRIMARY_HOST" "$v6" false

  log "Syncing Cloudflare DNS: ${APEX_HOST} -> Fly (proxied, for apex redirect rule)"
  upsert_dns_record "$zone_id" "A" "$APEX_HOST" "$v4" true
  upsert_dns_record "$zone_id" "AAAA" "$APEX_HOST" "$v6" true
}

ensure_apex_redirect() {
  local zone_id=$1
  local response payload

  log "Configuring Cloudflare redirect: ${APEX_HOST} -> https://${PRIMARY_HOST}"
  payload="$(jq -n \
    --arg desc "Redirect apex to www" \
    --arg apex "$APEX_HOST" \
    --arg www "https://${PRIMARY_HOST}" \
    '{
      rules: [{
        description: $desc,
        expression: ("(http.host eq \"" + $apex + "\")"),
        action: "redirect",
        action_parameters: {
          from_value: {
            status_code: 301,
            target_url: {
              expression: ("concat(\"" + $www + "\", http.request.uri.path)")
            },
            preserve_query_string: true
          }
        }
      }]
    }')"

  response="$(cf_api PUT "/zones/${zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint" -d "$payload")"
  cf_assert_success "$response" "set apex redirect rule"
}

wait_for_certificate() {
  local host=$1
  local attempts=18
  local status

  log "Waiting up to ${attempts}0s for TLS certificate on ${host}"
  for ((i = 1; i <= attempts; i++)); do
    status="$(flyctl certs list -a "$APP_NAME" --json | jq -r --arg host "$host" '.[] | select(.hostname == $host) | .status')"
    if [[ "$status" == "Ready" ]]; then
      log "TLS certificate for ${host} is ready"
      return 0
    fi
    if [[ "$i" -eq "$attempts" ]]; then
      log "Certificate for ${host} still '${status:-unknown}'; deploying anyway"
      return 0
    fi
    sleep 10
  done
}

wait_for_certificates() {
  wait_for_certificate "$PRIMARY_HOST"
  wait_for_certificate "$APEX_HOST"
}

ensure_single_machine() {
  log "Ensuring ${APP_NAME} runs a single machine per process group (web, worker)"
  flyctl scale count web=1 worker=1 -a "$APP_NAME" -y
}

deploy_app() {
  log "Deploying ${APP_NAME}"
  flyctl deploy --remote-only -a "$APP_NAME" --ha=false
}

main() {
  require_env FLY_API_TOKEN
  require_env VAULT_TOKEN
  require_env CLOUDFLARE_API_TOKEN

  export FLY_API_TOKEN

  log "Provisioning Fly app ${APP_NAME} for ${PRIMARY_HOST} (apex ${APEX_HOST} redirects to www)"
  ensure_app
  ensure_ips
  sync_runtime_secrets
  ensure_certificates
  sync_cloudflare_dns
  ensure_apex_redirect "$(cloudflare_zone_id)"
  wait_for_certificates
  ensure_single_machine
  deploy_app
  log "Deploy complete"
}

main "$@"
