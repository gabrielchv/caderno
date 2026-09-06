output "realtime_url" {
  description = "Public URL of the realtime (Socket.IO) service."
  value       = google_cloud_run_v2_service.realtime.uri
}

output "web_url" {
  description = "Public URL of the web application."
  value       = google_cloud_run_v2_service.web.uri
}

output "realtime_service" {
  description = "Fully qualified realtime service id."
  value       = google_cloud_run_v2_service.realtime.id
}

output "web_service" {
  description = "Fully qualified web service id."
  value       = google_cloud_run_v2_service.web.id
}
