// src/autoAttach.ts
import { P2PDhtClient, type CreateClientOptions } from "./p2pClient.js";

/**
 * Auto-discover a local dl-dht node via HTTP and attach over libp2p.
 * Discovery order:
 *   1) DLDHT_STATUS_URL (if set)
 *   2) http://127.0.0.1:46346 (selfaddrs then status)
 *   3) http://localhost:46346 (selfaddrs then status)
 */
export async function autoAttach(): Promise<P2PDhtClient> {
  const bases = [
    process.env.DLDHT_STATUS_URL?.replace(/\/v1\/status$/, ""), // allow direct status URL
    "http://127.0.0.1:46346",
    "http://localhost:46346",
  ].filter(Boolean) as string[];

  for (const base of bases) {
    // 1) Try /v1/selfaddrs (best source of actual libp2p listen addrs)
    const fromSelf = await trySelfAddrs(`${base}/v1/selfaddrs`);
    if (fromSelf) return new P2PDhtClient(fromSelf);

    // 2) Try /v1/status (peerId, maybe addrs)
    const fromStatus = await tryStatus(`${base}/v1/status`);
    if (fromStatus) return new P2PDhtClient(fromStatus);
  }

  throw new Error("No dl-dht node found. Start the node or set DLDHT_STATUS_URL.");
}

function isValidPeerId(s?: string): boolean {
  if (!s) return false;
  // Accept CIDv1 ("12D3Koo…") or CIDv0 ("Qm…") peer IDs
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
  } catch { return null; }
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
    if (addrs.length === 0) addrs = ["/ip4/127.0.0.1/tcp/46345"]; // last-resort default
    const info = { peerId, addrs };
    return isValidInfo(info) ? info : null;
  } catch { return null; }
}

function uniqValidMultiaddrs(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of xs) {
    // take useful TCP addrs; ignore ws/quic here since the JS client is tcp only
    if (s.startsWith("/ip4/") || s.startsWith("/ip6/")) {
      if (s.includes("/tcp/")) {
        if (!s.includes("/p2p/")) out.push(s);
        else out.push(s.split("/p2p/")[0]); // strip trailing /p2p/…; we’ll add it ourselves
      }
    }
  }
  for (const s of out) if (!seen.has(s)) seen.add(s);
  return [...seen];
}