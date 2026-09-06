variable "project_id" {
  type        = string
  description = "GCP project where the Caderno Cloud Run services are deployed."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP region for the Cloud Run services."
}

variable "image_web" {
  type        = string
  description = "Container image reference for the web service (tagged by git SHA)."
}

variable "image_realtime" {
  type        = string
  description = "Container image reference for the realtime service (tagged by git SHA)."
}

variable "realtime_url_env" {
  type        = string
  description = "Server-side URL the web service uses to reach the realtime service."
  default     = ""
}

variable "cors_origin" {
  type        = string
  description = "Allowed browser origin for realtime WebSocket connections. Set to the web service's public URL once a custom domain exists."
  default     = "*"
}

variable "otlp_endpoint" {
  type        = string
  description = "OTLP exporter endpoint (optional; empty disables OTLP tracing export)."
  default     = ""
}

variable "otel_service_name" {
  type        = string
  description = "Service name reported to the trace backend."
  default     = "caderno-realtime"
}
