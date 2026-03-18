import { P2PDhtClient, type CreateClientOptions } from "./p2pClient.js";

export type AutoAttachOptions = {
  httpURL?: string;
};

export async function autoAttach(opts: AutoAttachOptions = {}): Promise<P2PDhtClient> {
  const explicitBase = opts.httpURL?.replace(/\/v1\/(status|selfaddrs)$/, "").replace(/\/+$/, "");

  const bases = [
    explicitBase,
    process.env.DLDHT_STATUS_URL?.replace(/\/v1\/(status|selfaddrs)$/, "").replace(/\/+$/, ""),
    "http://127.0.0.1:46346",
    "http://localhost:46346",
  ].filter(Boolean) as string[];

  for (const base of bases) {
    const fromSelf = await trySelfAddrs(`${base}/v1/selfaddrs`);
    if (fromSelf) {
      const c = new P2PDhtClient(fromSelf);
      await c.start();
      return c;
    }

    const fromStatus = await tryStatus(`${base}/v1/status`);
    if (fromStatus) {
      const c = new P2PDhtClient(fromStatus);
      await c.start();
      return c;
    }
  }

  throw new Error("No dl-dht node found. Start the node or set DLDHT_STATUS_URL.");
}

function isValidPeerId(s?: string): boolean {
  if (!s) return false;
  return /^12D3[Kk]oo[1-9A-HJ-NP-Za-km-z]{40,}$/.test(s) || /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(s);
}

function isValidAddrs(a?: unknown): a is string[] {
  return Array.isArray(a) && a.length > 0 && a.every(x => typeof x === "string" && x.startsWith("/"));
}

function isValidInfo(x?: Partial<CreateClientOptions> | null): x is CreateClientOptions {
  return !!(x && isValidPeerId(x.peerId) && isValidAddrs(x.addrs));
}

async function trySelfAddrs(url: string): Promise<CreateClientOptions | null> {
  try {
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json();
    const peerId = String(j?.peerId || j?.PeerID || "");
    const raw = [
      ...(Array.isArray(j?.listeningAddrs) ? j.listeningAddrs : []),
      ...(Array.isArray(j?.advertisedAddrs) ? j.advertisedAddrs : []),
    ].map((s: any) => String(s)).filter(Boolean);
    const addrs = uniqValidMultiaddrs(raw);
    const info = { peerId, addrs };
    return isValidInfo(info) ? info : null;
  } catch {
    return null;
  }
}

async function tryStatus(url: string): Promise<CreateClientOptions | null> {
  try {
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json();
    const peerId = String(j?.peerId || j?.PeerID || "");
    let addrs: string[] = [];
    if (Array.isArray(j?.addrs)) addrs = j.addrs.map((s: any) => String(s));
    else if (Array.isArray(j?.listenAddrs)) addrs = j.listenAddrs.map((s: any) => String(s));
    else if (Array.isArray(j?.listeningAddrs)) addrs = j.listeningAddrs.map((s: any) => String(s));
    if (addrs.length === 0) addrs = ["/ip4/127.0.0.1/tcp/46345"];
    const info = { peerId, addrs };
    return isValidInfo(info) ? info : null;
  } catch {
    return null;
  }
}

function uniqValidMultiaddrs(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of xs) {
    if ((s.startsWith("/ip4/") || s.startsWith("/ip6/")) && s.includes("/tcp/")) {
      out.push(s.includes("/p2p/") ? s.split("/p2p/")[0] : s);
    }
  }
  for (const s of out) {
    if (!seen.has(s)) seen.add(s);
  }
  return [...seen];
}