# @delabs/dl-dht-sdk-js

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
npm i @delabs/dl-dht-sdk-js

# Or latest beta
npm i @delabs/dl-dht-sdk-js@beta
```

3) **Use it**:

```ts
import { createClient } from "@delabs/dl-dht-sdk-js";

const peerId = process.env.DHT_REMOTE_PEER_ID!;
const addrs  = (process.env.DHT_REMOTE_ADDRS || "/ip4/127.0.0.1/tcp/46345").split(",");

const dht = await createClient({ peerId, addrs });

await dht.put("/dl/projA/hello", Buffer.from("world"), 3600);
const v = await dht.get("/dl/projA/hello");
console.log("got:", v ? Buffer.from(v).toString("utf8") : null);

console.log("status:", await dht.status());

await dht.stop();
```

## API

- `createClient({ peerId, addrs, protocolId?, dialTimeoutMs?, streamTimeoutMs? }) → Promise<P2PDhtClient> Returns a ready-to-use P2PDhtClient instance.`
- `P2PDhtClient#put(key, value, ttlSec?)`
- `P2PDhtClient#get(key) → Uint8Array|null`
- `P2PDhtClient#del(key)`
- `P2PDhtClient#status() → any`
- `P2PDhtClient#stop()`

- Protocol default: `/dl/api/1.0.0`

### Advanced usage

- If you want full control, you can use the P2PDhtClient class directly instead of createClient

```ts
import { P2PDhtClient } from "@delabs/dl-dht-sdk-js";

const dht = new P2PDhtClient({
  peerId: process.env.DHT_REMOTE_PEER_ID!,
  addrs: (process.env.DHT_REMOTE_ADDRS || "/ip4/127.0.0.1/tcp/46345").split(","),
  dialTimeoutMs: 15000,      // optional override
  streamTimeoutMs: 30000     // optional override
});

await dht.start();

await dht.put("/dl/projA/hello", Buffer.from("advanced"), 600);
console.log("got:", Buffer.from(await dht.get("/dl/projA/hello") || []).toString());

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
