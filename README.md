# @delabs/dl-dht-sdk

- Attach-only mesh client for **dl-dht**.
- Talks JSON-RPC over libp2p to a running dl-dht node (no HTTP).
- Node.js 22+ required.
- This package does **not** install Docker or the dl-dht node. Run the node yourself (Docker or bare metal) and attach to it.

## Quick start

1) **Run a dl-dht node** with Docker Compose:

```bash
curl -O https://raw.githubusercontent.com/delabs-dev/dl-dht/main/docker-compose.yml
docker compose up -d
```

```bash
# Check logs to find the PeerID and multiaddrs
docker logs -f dl-dht
```

2) **Install the client**:

```bash
# Stable release
npm i @delabs/dl-dht-sdk

# Or latest beta
npm i @delabs/dl-dht-sdk@beta
```

3) **Use it**:

```ts
import { autoAttach, makeKey } from "@delabs/dl-dht-sdk";

const c = await autoAttach(); // auto-discovers local node (http://127.0.0.1:46346)

// Build a safe key: /<group>/<root>/<path>
const key = makeKey("ns", "ns-foo-aaaabbbbccccdddd", "sdk", "demo.txt");

await c.put(key, new TextEncoder().encode("hello from sdk"), 3600);

const got = await c.get(key);
console.log(new TextDecoder().decode(got)); // "hello from sdk"

await c.del(key);
console.log(await c.get(key)); // null (after delete)

await c.stop();
```

## Key format

**All keys are scoped**:
- /< group >/< root >/< path... >

- Group → one of ns, cert, agent (fixed by dl-dht).
- Root → a token such as ns-foo-aaaabbbbccccdddd.
- Path → free-form path segments.

**Examples**:
-	/ns/ns-ur-6pj0e2r7qz5s3y1f/demo/hello.txt
-	/cert/cert-xyz1234/public.pem
-	/agent/agent-foo/logs/2025-09-28.json

Use makeKey(group, root, ...path) to avoid mistakes.

## API

- `createClient({ peerId, addrs, protocolId?, dialTimeoutMs?, streamTimeoutMs? }) → Promise<P2PDhtClient> Returns a ready-to-use P2PDhtClient instance.`
- `P2PDhtClient#put(key, value, ttlSec?)`
- `P2PDhtClient#get(key) → Uint8Array|null`
- `P2PDhtClient#del(key)`
- `P2PDhtClient#status() → any`
- `P2PDhtClient#stop()`

- Protocol default: `/dl/api/1.0.0`

## Errors

The SDK throws typed errors so you can branch:
-	KeyShapeError — key not well-formed (/< group >/< root >/< path >).
-	ValueTooLargeError — exceeds per-root byte cap.
-	NotFoundError — missing record.

### Advanced usage

- If you want full control, you can use the P2PDhtClient class directly instead of createClient

```ts
import { P2PDhtClient } from "@delabs/dl-dht-sdk";

const dht = new P2PDhtClient({
  peerId: process.env.DHT_REMOTE_PEER_ID!,
  addrs: (process.env.DHT_REMOTE_ADDRS || "/ip4/127.0.0.1/tcp/46345").split(","),
  dialTimeoutMs: 15000,
  streamTimeoutMs: 30000
});

await dht.start();
await dht.put("/ns/ns-foo-aaaabbbbccccdddd/advanced.txt", Buffer.from("advanced"), 600);
console.log("got:", new TextDecoder().decode(await dht.get("/ns/ns-foo-aaaabbbbccccdddd/advanced.txt")));
await dht.stop();
```
- This form is useful if you want to manage start() and stop() explicitly, or adjust timeouts and protocol ID.

### Which one should I use?

| Use case                         | `createClient(...)`                              | `new P2PDhtClient(...)`                        |
|----------------------------------|--------------------------------------------------|------------------------------------------------|
| Quick start / simplest setup     | ✅ Best choice                                   | Possible, but overkill                         |
| Auto-start lifecycle             | ✅ Automatically starts                          | ❌ You call `start()` / `stop()` yourself      |
| Sensible defaults (timeouts etc) | ✅ Built-in                                      | ➖ You can override everything                  |
| Fine-grained control             | ➖ Limited                                       | ✅ Full control over timeouts & protocol ID     |
| Custom connection management     | ➖ Minimal knobs                                  | ✅ You decide when to reuse/restart clients     |
| Advanced debugging               | ➖ Basic                                          | ✅ Pair with `DEBUG_DL_DHT=1` for deep logs     |
| Library/framework integration    | ✅ Simple DI                                      | ✅ Useful when you need explicit lifecycle      |

**Rule of thumb:**  
Start with `createClient` for almost everything. Reach for `P2PDhtClient` when you need explicit lifecycle control or tuning.

## License
MIT © DeLabs
