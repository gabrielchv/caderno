#!/usr/bin/env bash
# Two-wave Cloud Run deploy.
#
# The browser must reach the realtime service at a URL baked into the web image
# (NEXT_PUBLIC_REALTIME_URL). That URL only exists after the realtime service is
# live, so: 1) deploy realtime alone, 2) read its URL, 3) build the web image
# against it, 4) deploy the web service.
#
# Requires: authenticated gcloud + docker access to $REGISTRY, terraform in PATH.
#
#   PROJECT_ID=<project> REGISTRY=$REGION-docker.pkg.dev/<project>/caderno ./terraform/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="${SHA:-$(git -C "$ROOT" rev-parse --short HEAD)}"
: "${PROJECT_ID:?set PROJECT_ID}"
: "${REGISTRY:?set REGISTRY (e.g. us-central1-docker.pkg.dev/PROJECT/caderno)}"
: "${GCS_BUCKET:?set GCS_BUCKET (terraform state bucket)}"
REGION="${REGION:-us-central1}"
CORS_ORIGIN="${CORS_ORIGIN:-*}"

RT_IMG="$REGISTRY/realtime:$SHA"
WEB_IMG="$REGISTRY/web:$SHA"

echo "==> [$SHA] deploy realtime service"
docker build -f "$ROOT/apps/realtime/Dockerfile" -t "$RT_IMG" "$ROOT"
docker push "$RT_IMG"

cd "$ROOT/terraform"
terraform init -input=false -reconfigure -backend-config="bucket=$GCS_BUCKET"
terraform apply -auto-approve \
  -target=google_cloud_run_v2_service.realtime \
  -target=google_cloud_run_v2_service_iam_member.realtime_public \
  -var "project_id=$PROJECT_ID" \
  -var "region=$REGION" \
  -var "image_realtime=$RT_IMG" \
  -var "image_web=$WEB_IMG" \
  -var "cors_origin=$CORS_ORIGIN"

REALTIME_URL="$(terraform output -raw realtime_url)"
echo "==> realtime live at $REALTIME_URL"

echo "==> build web image against $REALTIME_URL"
cd "$ROOT"
docker build \
  --build-arg "NEXT_PUBLIC_REALTIME_URL=$REALTIME_URL" \
  -f "$ROOT/apps/web/Dockerfile" \
  -t "$WEB_IMG" \
  "$ROOT"
docker push "$WEB_IMG"

echo "==> deploy web service"
cd "$ROOT/terraform"
terraform init -input=false -reconfigure -backend-config="bucket=$GCS_BUCKET"
terraform apply -auto-approve \
  -var "project_id=$PROJECT_ID" \
  -var "region=$REGION" \
  -var "image_realtime=$RT_IMG" \
  -var "image_web=$WEB_IMG" \
  -var "cors_origin=$CORS_ORIGIN"

echo "==> done"
terraform output web_url
