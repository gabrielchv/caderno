import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { trace } from '@opentelemetry/api'
import { logger } from './logger'

export const tracer = trace.getTracer('caderno-realtime')

let sdk: NodeSDK | null = null

/**
 * Start tracing. Console exporter by default (zero-config dev); switch to OTLP
 * HTTP by setting OTEL_EXPORTER_OTLP_ENDPOINT (e.g. a collector / Grafana Cloud
 * OTLP gateway). The same spans go either way.
 */
export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  const exporter = endpoint
    ? new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })
    : new ConsoleSpanExporter()

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'caderno-realtime',
    traceExporter: exporter,
  })
  sdk.start()
  logger.info({ endpoint: endpoint ?? 'console' }, 'tracing started')
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown()
}
