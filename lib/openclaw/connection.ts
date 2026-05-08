import WebSocket from "ws";
import type { GatewayConfig } from "./config";
import { parseFrame, makeRequest, type Frame } from "./protocol";

type ReadyState = "connecting" | "ready" | "closed" | "error";

type Queue = {
  push: (e: { event: string; payload: unknown; seq?: number }) => void;
  end: () => void;
};

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private state: ReadyState = "connecting";
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;
  private connectReqId: string | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private subs = new Map<string, { queues: Set<Queue>; refcount: number }>();

  constructor(private cfg: GatewayConfig) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.connect();
  }

  static fromConfig(cfg: GatewayConfig): GatewayConnection {
    return new GatewayConnection(cfg);
  }

  ready(): Promise<void> { return this.readyPromise; }

  async invoke(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
    if (this.state !== "ready") await this.readyPromise;
    if (this.state !== "ready") throw new Error("connection not ready");
    const req = makeRequest(method, params);
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject });
      if (signal) {
        if (signal.aborted) {
          this.pending.delete(req.id);
          reject(new Error("aborted"));
          return;
        }
        signal.addEventListener("abort", () => {
          if (this.pending.has(req.id)) {
            this.pending.delete(req.id);
            reject(new Error("aborted"));
          }
        }, { once: true });
      }
      try {
        this.ws!.send(JSON.stringify(req));
      } catch (e) {
        this.pending.delete(req.id);
        reject(e as Error);
      }
    });
  }

  subscribe(sessionKey: string): {
    events: AsyncIterable<{ event: string; payload: unknown; seq?: number }>;
    unsubscribe: () => Promise<void>;
  } {
    const queueBuf: { event: string; payload: unknown; seq?: number }[] = [];
    let waiter: ((v: void) => void) | null = null;
    let ended = false;
    const queue: Queue = {
      push: (e) => { queueBuf.push(e); waiter?.(); waiter = null; },
      end: () => { ended = true; waiter?.(); waiter = null; },
    };

    const events = (async function* () {
      while (true) {
        while (queueBuf.length) yield queueBuf.shift()!;
        if (ended) return;
        await new Promise<void>((res) => { waiter = res; });
      }
    })();

    let entry = this.subs.get(sessionKey);
    if (!entry) {
      entry = { queues: new Set(), refcount: 0 };
      this.subs.set(sessionKey, entry);
    }
    entry.queues.add(queue);
    entry.refcount++;

    // First subscriber sends both upstream subscribes
    const initPromise = entry.refcount === 1
      ? Promise.all([
          this.invoke("sessions.messages.subscribe", { key: sessionKey }).catch(() => undefined),
          this.invoke("sessions.subscribe", { key: sessionKey }).catch(() => undefined),
        ]).then(() => undefined)
      : Promise.resolve();

    const unsubscribe = async () => {
      queue.end();
      const e = this.subs.get(sessionKey);
      if (!e) return;
      e.queues.delete(queue);
      e.refcount--;
      if (e.refcount === 0) {
        this.subs.delete(sessionKey);
        await Promise.all([
          this.invoke("sessions.messages.unsubscribe", { key: sessionKey }).catch(() => undefined),
          this.invoke("sessions.unsubscribe", { key: sessionKey }).catch(() => undefined),
        ]);
      }
    };

    const guardedEvents = (async function* () {
      await initPromise;
      for await (const e of events) yield e;
    })();

    return { events: guardedEvents, unsubscribe };
  }

  private connect() {
    const wsUrl = this.cfg.url.replace(/^http/, "ws") + "/";
    this.ws = new WebSocket(wsUrl);
    this.ws.on("message", (raw) => this.onFrame(raw.toString()));
    this.ws.on("close", () => {
      if (this.state === "connecting") this.readyReject(new Error("closed before handshake"));
      this.state = "closed";
    });
    this.ws.on("error", (e) => {
      if (this.state === "connecting") this.readyReject(e);
      this.state = "error";
    });
  }

  private onFrame(raw: string) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }
    const f = parseFrame(parsed);
    if (!f) return;
    if (this.state === "connecting") { this.handleHandshakeFrame(f); return; }
    if (f.type === "res") {
      const w = this.pending.get(f.id);
      if (!w) return;
      this.pending.delete(f.id);
      if (f.ok) w.resolve(f.payload);
      else w.reject(new Error(f.error?.message ?? "rpc failed"));
      return;
    }
    if (f.type === "event") {
      const sessionKey = (f.payload as { sessionKey?: string } | null | undefined)?.sessionKey;
      if (!sessionKey) return; // ignore non-session events
      const entry = this.subs.get(sessionKey);
      if (!entry) return; // not subscribed to this session — drop
      for (const q of entry.queues) q.push({ event: f.event, payload: f.payload, seq: f.seq });
      return;
    }
  }

  private handleHandshakeFrame(f: Frame) {
    if (f.type === "event" && f.event === "connect.challenge") {
      const req = makeRequest("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: "gateway-client", version: "0.1.0", platform: "node", mode: "backend" },
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: this.cfg.token },
        locale: "en-US",
        userAgent: "clawapp/0.1.0",
      });
      this.connectReqId = req.id;
      this.ws!.send(JSON.stringify(req));
      return;
    }
    if (f.type === "res" && f.id === this.connectReqId) {
      if (f.ok) {
        this.state = "ready";
        this.readyResolve();
      } else {
        this.readyReject(new Error(f.error?.message ?? "handshake failed"));
        this.state = "error";
      }
    }
  }

  async close(): Promise<void> {
    for (const [, entry] of this.subs) for (const q of entry.queues) q.end();
    this.subs.clear();
    for (const [, w] of this.pending) w.reject(new Error("connection closed"));
    this.pending.clear();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.state = "closed";
  }
}
