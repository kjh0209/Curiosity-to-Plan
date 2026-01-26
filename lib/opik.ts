import { Opik } from "opik";

let opikClient: Opik | null = null;

export function getOpikClient(): Opik {
  if (!opikClient) {
    opikClient = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      apiUrl: process.env.OPIK_URL_OVERRIDE || "https://www.comet.com/opik/api",
      projectName: process.env.OPIK_PROJECT_NAME || "skillloop",
      workspaceName: process.env.OPIK_WORKSPACE_NAME,
    });
  }
  return opikClient;
}

export async function withOpikTrace<T>(
  traceName: string,
  input: Record<string, unknown>,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const opik = getOpikClient();
  const startTime = Date.now();

  try {
    const output = await fn();
    const latency_ms = Date.now() - startTime;

    // Convert output to a JSON-serializable format for Opik
    const outputForOpik = JSON.parse(JSON.stringify(output)) as Record<string, unknown>;

    const trace = opik.trace({
      name: traceName,
      input,
      output: outputForOpik,
      metadata: {
        ...metadata,
        latency_ms,
      },
    });

    // Create an LLM span for the trace
    const span = trace.span({
      name: `${traceName}_llm_call`,
      type: "llm",
      input,
      output: outputForOpik,
      metadata: {
        ...metadata,
        latency_ms,
      },
    });

    span.end();
    trace.end();
    await opik.flush();
    return output;
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    const trace = opik.trace({
      name: traceName,
      input,
      output: { error: String(error) },
      metadata: {
        ...metadata,
        latency_ms,
        error: true,
      },
    });
    trace.end();
    await opik.flush();
    throw error;
  }
}
