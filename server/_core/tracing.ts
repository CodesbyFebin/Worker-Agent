import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { env } from "./env";

let sdk: NodeSDK | null = null;

export function initTracing() {
  if (sdk) return sdk;

  const traceExporter = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    ? new OTLPTraceExporter({
        url: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      })
    : undefined;

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-http": { enabled: true } })],
    serviceName: env.OTEL_SERVICE_NAME,
  });

  sdk.start();
  return sdk;
}

export async function shutdownTracing() {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}
