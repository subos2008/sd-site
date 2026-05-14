import { trace, type Tracer } from '@opentelemetry/api'
import {
  WebTracerProvider,
  BatchSpanProcessor,
  NoopSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-web'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'

let tracer: Tracer | null = null

/**
 * Initialise OpenTelemetry tracing.
 *
 * If `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` is unset, a NoopSpanProcessor is used
 * so spans are still created but dropped silently. This keeps the same code
 * path in production whether an OTEL backend is configured or not.
 *
 * Idempotent: subsequent calls return the cached tracer.
 */
export function initOtel(): Tracer {
  if (tracer) return tracer

  const endpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined
  const serviceName =
    (import.meta.env.VITE_OTEL_SERVICE_NAME as string | undefined) ?? 'sd-site-frontend'
  const serviceVersion =
    (import.meta.env.VITE_OTEL_SERVICE_VERSION as string | undefined) ?? '0.0.0'

  const spanProcessors: SpanProcessor[] = endpoint
    ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint }))]
    : [new NoopSpanProcessor()]

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    spanProcessors,
  })

  provider.register()
  registerInstrumentations({ instrumentations: [new FetchInstrumentation()] })

  tracer = trace.getTracer(serviceName, serviceVersion)
  return tracer
}

export function getTracer(): Tracer {
  return tracer ?? initOtel()
}
