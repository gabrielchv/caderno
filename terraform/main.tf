terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- Realtime: Socket.IO presence + doc sync ---------------------------------

resource "google_cloud_run_v2_service" "realtime" {
  name     = "caderno-realtime"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    session_affinity = true

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }

    timeout = "300s"

    containers {
      image = var.image_realtime

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "CORS_ORIGIN"
        value = var.cors_origin
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
        value = var.otlp_endpoint
      }
      env {
        name  = "OTEL_SERVICE_NAME"
        value = var.otel_service_name
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/healthz"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# --- Web: Next.js UI, API routes, vitals ingest ------------------------------

resource "google_cloud_run_v2_service" "web" {
  name     = "caderno-web"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.image_web

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      # Server-side fetch target for /api/vitals. The browser socket URL is
      # baked into the image at build time (NEXT_PUBLIC_REALTIME_URL).
      env {
        name  = "REALTIME_URL"
        value = coalesce(var.realtime_url_env, google_cloud_run_v2_service.realtime.uri)
      }

      startup_probe {
        http_get {
          path = "/"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 5
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# --- Public access (unauthenticated invocations) -----------------------------

resource "google_cloud_run_v2_service_iam_member" "realtime_public" {
  project  = google_cloud_run_v2_service.realtime.project
  location = google_cloud_run_v2_service.realtime.location
  name     = google_cloud_run_v2_service.realtime.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = google_cloud_run_v2_service.web.project
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
