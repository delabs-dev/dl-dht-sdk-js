import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { identify } from "@libp2p/identify";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";
import { pipe } from "it-pipe";
import { fromString as u8From, toString as u8To } from "uint8arrays";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { tls } from "@libp2p/tls";

const DBG = !!process.env.DEBUG_DL_DHT;
function dlog(...a: any[]) { if (DBG) console.debug("[dl-dht]", ...a); }

export type CreateClientOptions = {
  peerId: string;
  addrs: string[];
  protocolId?: string;
  dialTimeoutMs?: number;
  streamTimeoutMs?: number;
};

export class P2PDhtClient {
  private libp2p!: any;
  private remotePeerIdStr: string;
  private remoteMas: Multiaddr[] = [];
  private protocol: string;
  private dialTimeoutMs: number;
  private streamTimeoutMs: number;
  private started = false;

  constructor(private opts: CreateClientOptions) {
    if (!opts?.peerId) throw new Error("peerId is required");
    if (!opts?.addrs?.length) throw new Error("addrs[] must include at least one multiaddr");
    this.remotePeerIdStr = String(opts.peerId).trim();
    this.remoteMas = opts.addrs.map((s) => multiaddr(s.trim())).filter(Boolean);
    this.protocol = opts.protocolId ?? "/dl/api/1.0.0";
    this.dialTimeoutMs = opts.dialTimeoutMs ?? 10_000;
    this.streamTimeoutMs = opts.streamTimeoutMs ?? 20_000;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const pid = await createEd25519PeerId();
    const encs = [tls(), noise()];

    this.libp2p = await (createLibp2p as any)({
      peerId: pid,
      start: true,
      transports: [tcp()],
      connectionEncryption: encs,
      connectionEncrypters: encs,
      streamMuxers: [mplex()], // node side uses mplex; server advertises yamux+mplex
      services: { identify: identify() }
    });

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.libp2p.stop();
    this.started = false;
  }

  async put(key: string, value: Uint8Array | Buffer, ttlSec = 0): Promise<void> {
    validateKey(key);
    const req = { op: "put", key, ttl: ttlSec || undefined, value: toU8(value) };
    const r = await this.rpc(req);
    if (r.err) throw new Error(r.err);
  }

  async get(key: string): Promise<Uint8Array | null> {
    validateKey(key);
    const r = await this.rpc({ op: "get", key });
    if (r.err === "not found") return null;
    if (r.err) throw new Error(r.err);
    return (r.value as Uint8Array) ?? null;
  }

  async del(key: string): Promise<void> {
    validateKey(key);
    const r = await this.rpc({ op: "del", key });
    if (r.err) throw new Error(r.err);
  }

  async status(): Promise<any> {
    const r = await this.rpc({ op: "status" });
    if (r.err) throw new Error(r.err);

    // Server returns {value:<json-bytes>} — decode that
    if (r.value instanceof Uint8Array) {
      const txt = u8To(r.value, "utf8").trim();
      return txt ? JSON.parse(txt) : {};
    }
    // Or sometimes a direct JSON object with status fields
    if (r && typeof r === "object" && !("value" in r)) return r;

    return {};
  }

  private async probeProtocols(target: Multiaddr): Promise<string[]> {
    try { await withTimeout(this.libp2p.dial(target), this.dialTimeoutMs, `dial timeout to ${target}`); } catch {}
    const pidStr = this.remotePeerIdStr;
    const ps: any = (this.libp2p as any).peerStore;
    if (typeof ps?.getProtocols === "function") {
      try { return (await ps.getProtocols(pidStr)) ?? []; } catch {}
    }
    const idsvc = (this.libp2p as any).services?.identify;
    if (idsvc?.identify) {
      try {
        await idsvc.identify(pidStr);
        return (await ps.getProtocols(pidStr)) ?? [];
      } catch {}
    }
    return [];
  }

  // ---- Core RPC over libp2p stream ----
  private async rpc(reqObj: any): Promise<{ err?: string; value?: Uint8Array } & Record<string, any>> {
    if (!this.started) await this.start();

    const targets = this.buildTargets();
    const tryProtocols = Array.from(new Set([
      this.protocol, "/dl/api/1.0.0", "/dl/api/1.0", "/dl/api/1"
    ]));

    let lastErr: unknown;

    for (const t of targets) {
      if (DBG) {
        const protos = await this.probeProtocols(t).catch(() => []);
        dlog("remote reports protocols:", protos);
      }

      for (const pid of tryProtocols) {
        try {
          await withTimeout(this.libp2p.dial(t), this.dialTimeoutMs, `dial timeout to ${t.toString()}`);

          const stream: any = await withTimeout(
            this.libp2p.dialProtocol(t, pid),
            this.streamTimeoutMs,
            `open stream timeout to ${t.toString()} (${pid})`
          );
          dlog("using protocol:", pid);

          // Force .value → base64 string so Go can unmarshal []byte
          const reqToSend: any = { ...reqObj };
          if (reqToSend.value != null) {
            const u8 = toU8(reqToSend.value);
            reqToSend.value = Buffer.from(u8).toString("base64");
          }
          const json = JSON.stringify(reqToSend) + "\n";

          // Write request, then half-close write so Go's json.Decoder returns
          await pipe([u8From(json, "utf8")], stream.sink);
          if (typeof stream.closeWrite === "function") {
            await stream.closeWrite();
          }

          // Read one JSON-encoded response
          const got = await readOneJsonWithTimeout(stream.source, 4000);
          const clean = got.replace(/\u0000+$/g, "").trim();
          dlog("raw reply:", clean ? `(len=${clean.length}) ${preview(clean)}` : "(empty)");

          try { await stream.close?.(); } catch {}

          if (!clean) return {} as any;

          const resp = JSON.parse(clean, (k, v) =>
            k === "value" && typeof v === "string"
              ? Uint8Array.from(Buffer.from(v, "base64"))
              : v
          );
          return resp;
        } catch (e) {
          lastErr = e;
        }
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private buildTargets(): Multiaddr[] {
    if (this.remoteMas.length === 0) throw new Error("no remote addresses provided");
    const pid = this.remotePeerIdStr;
    const targets: Multiaddr[] = [];
    for (const base of this.remoteMas) {
      const s = base.toString();
      const t = s.includes("/p2p/") ? base : base.encapsulate(multiaddr(`/p2p/${pid}`));
      targets.push(t);
    }
    return targets;
  }
}

// ---------------- utils ----------------

function validateKey(fullKey: string) {
  const s = (fullKey || "").trim();
  if (!s.startsWith("/")) throw new Error(`key must start with "/" (got ${JSON.stringify(fullKey)})`);
  const rest = s.slice(1);
  const i = rest.indexOf("/");
  if (i <= 0 || i === rest.length - 1) throw new Error(`key must look like /<namespace>/<key> (got ${JSON.stringify(fullKey)})`);
  const ns = rest.slice(0, i);
  if (ns.includes(" ")) throw new Error("namespace must not contain spaces");
}
function toU8(x: Uint8Array | Buffer): Uint8Array { return x instanceof Uint8Array ? x : new Uint8Array(x); }
function concatU8(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let to: any;
  try { return await Promise.race([p, new Promise<T>((_, rej) => (to = setTimeout(() => rej(new Error(label)), ms)))]); }
  finally { clearTimeout(to); }
}

/** Normalize possibly-Uint8ArrayList chunks into plain Uint8Array. */
function normalizeChunk(x: any): Uint8Array {
  if (x == null) return new Uint8Array(0);
  if (typeof x.subarray === "function") {
    // Uint8ArrayList from @libp2p/utils exposes .subarray()
    const u = x.subarray();
    if (u instanceof Uint8Array) return u;
  }
  if (x instanceof Uint8Array) return x;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(x)) return new Uint8Array(x);
  if (x.buffer && typeof x.byteLength === "number") {
    try { return new Uint8Array(x.buffer, x.byteOffset ?? 0, x.byteLength); } catch {}
  }
  try { return new Uint8Array(x as ArrayLike<number>); } catch { return new Uint8Array(0); }
}

/** Read one JSON frame. Prefer newline-delimited (json.Encoder adds '\n').
 * If no newline appears within timeout, return whatever we accumulated. */
async function readOneJsonWithTimeout(
  src: AsyncIterable<Uint8Array>,
  timeoutMs = 4000
): Promise<string> {
  let buf = new Uint8Array(0);
  let done = false;

  const timer = setTimeout(() => { done = true; }, timeoutMs);
  try {
    for await (const chunk of src) {
      const c = normalizeChunk(chunk);
      const next = new Uint8Array(buf.length + c.length);
      next.set(buf, 0); next.set(c, buf.length);
      buf = next;

      const nl = buf.indexOf(10); // '\n'
      if (nl >= 0) return u8To(buf.subarray(0, nl), "utf8");

      // opportunistic: if buffer already parses as JSON, take it
      const txt = u8To(buf, "utf8");
      if (looksLikeCompleteJson(txt)) return txt;

      if (done) break;
    }
  } finally {
    clearTimeout(timer);
  }
  return u8To(buf, "utf8");
}

function looksLikeCompleteJson(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try { JSON.parse(t); return true; } catch { return false; }
  }
  return false;
}
function preview(s: string): string {
  const t = s.length > 160 ? s.slice(0, 160) + "..." : s;
  return t.replace(/\n/g, "\\n");
}