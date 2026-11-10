// Test-only helper: a minimal per-client cookie jar so a test can simulate
// two independent browsers (two identities) against the same running app,
// plus a small SSE line-reader since Node's fetch has no EventSource.
export interface Client {
  baseUrl: string;
  cookie: string | null;
  get(path: string): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
}

function updateCookie(client: { cookie: string | null }, res: Response): void {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    client.cookie = setCookie.split(";")[0];
  }
}

export function createClient(baseUrl: string): Client {
  const client: Client = {
    baseUrl,
    cookie: null,
    async get(path: string) {
      const res = await fetch(new URL(path, baseUrl), {
        headers: client.cookie ? { cookie: client.cookie } : {},
      });
      updateCookie(client, res);
      return res;
    },
    async post(path: string, body: unknown) {
      const res = await fetch(new URL(path, baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          ...(client.cookie ? { cookie: client.cookie } : {}),
        },
        body: JSON.stringify(body ?? {}),
      });
      updateCookie(client, res);
      return res;
    },
  };
  return client;
}

// Reads `count` SSE `data:` events from an open SSE response, parsing the
// `event\n\n`-delimited frames by hand (Node's fetch gives a ReadableStream,
// not an EventSource).
export async function readSseEvents(res: Response, count: number, timeoutMs = 10000): Promise<unknown[]> {
  const events: unknown[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (events.length < count) {
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for ${count} SSE event(s), got ${events.length}`);
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLines = chunk.split("\n").filter((l) => l.startsWith("data:"));
        if (dataLines.length > 0) {
          events.push(JSON.parse(dataLines.map((l) => l.slice(5).trim()).join("")));
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return events;
}
