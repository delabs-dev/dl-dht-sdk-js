# @delabs/dl-dht-sdk

JavaScript/TypeScript SDK for attaching to a running `dl-dht` node over libp2p RPC.

This SDK is for **remote-safe node operations**, including:

- object put/get/fetch/provider lookup
- pin / unpin
- node status
- discovery announce / lookup

This SDK does **not** expose local operator-only storage actions such as:

- list pinned objects
- list unpinned objects
- object stats
- object delete
- object GC

Those remain local-only in `dl-dht`.

## Install

```bash
npm install @delabs/dl-dht-sdk
```

## Quick start

### Auto-attach to a local node

```ts
import { autoAttach } from "@delabs/dl-dht-sdk";

const dht = await autoAttach({
  httpURL: "http://127.0.0.1:46346",
});

const status = await dht.status();
console.log(status);

await dht.stop();
```

### Create a client directly

```ts
import { createClient } from "@delabs/dl-dht-sdk";

const dht = await createClient({
  peerId: "12D3Koo...",
  addrs: ["/ip4/127.0.0.1/tcp/46345"],
});

const status = await dht.status();
console.log(status);

await dht.stop();
```
## Object API

### Put object

```ts
const objectId = await dht.putObject(
  new TextEncoder().encode(JSON.stringify({ hello: "world" }))
);

console.log(objectId); // sha256:...
```

### Get local object

```ts
const bytes = await dht.getObject(objectId);
console.log(new TextDecoder().decode(bytes));
```

### Fetch object from network

```ts
const bytes = await dht.fetchObject(objectId);
console.log(new TextDecoder().decode(bytes));
```

### Find providers

```ts
const providers = await dht.findProviders(objectId);
console.log(providers);
```

### Pin / unpin

```ts
await dht.pinObject(objectId);
await dht.unpinObject(objectId);
```

## Discovery API

### Announce discovery

```ts
await dht.announceDiscovery(
  "tld:xyz",
  "sha256:xxx",
  21600
);
```

## Lookup discovery

``` ts
const refs = await dht.lookupDiscovery("tld:uma");

console.log(refs);
```

Example output:

``` ts
[
  "sha256:abc...",
  "sha256:def..."
]
```

## API

### autoAttach(opts?)

Auto-discovers a local dl-dht node using its HTTP helper endpoints.

Options:

-   `httpURL?: string` --- base HTTP URL (default:
    `http://127.0.0.1:46346`)

Returns a started `P2PDhtClient`.

### createClient(opts)

Creates and starts a client directly.

Options:

-   `peerId: string`
-   `addrs: string[]`
-   `protocolId?: string`
-   `dialTimeoutMs?: number`
-   `streamTimeoutMs?: number`

Returns a started `P2PDhtClient`.

### P2PDhtClient

Methods:

    start()
    stop()

    status()

    putObject(bytes)
    getObject(objectId)
    fetchObject(objectId)
    findProviders(objectId)

    pinObject(objectId)
    unpinObject(objectId)

    announceDiscovery(discoveryKey, registrationRef, ttlSec)
    lookupDiscovery(discoveryKey)

Return types:

    status() → Promise<{ peerId?: string; conns?: number; rtSize?: number; dhtPrefix?: string }>

    putObject(bytes) → Promise<string>

    getObject(objectId) → Promise<Uint8Array | null>
    fetchObject(objectId) → Promise<Uint8Array | null>

    findProviders(objectId)
      → Promise<Array<{ peerId: string; addrs: string[] }>>

    pinObject(objectId) → Promise<void>
    unpinObject(objectId) → Promise<void>

    announceDiscovery(discoveryKey, registrationRef, ttlSec)
      → Promise<void>

    lookupDiscovery(discoveryKey)
      → Promise<string[]>

## Notes

Object IDs must look like:

    sha256:<64 lowercase hex chars>

Additional notes:

-   This SDK is intentionally limited to **remote-safe operations**.
-   Local operator lifecycle controls remain in `dl-dht`.
-   This SDK does **not start a dl-dht node**.
-   Run the daemon separately and then attach to it.
-   The default RPC protocol is `/dl/api/1.0.0`.

## License
MIT © DeLabs