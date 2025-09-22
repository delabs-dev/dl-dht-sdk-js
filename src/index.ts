// src/index.ts
import { P2PDhtClient, type CreateClientOptions } from "./p2pClient.js";

export async function createClient(opts: CreateClientOptions) {
  const c = new P2PDhtClient(opts);
  await c.start();
  return c;
}

export { autoAttach } from "./autoAttach.js";
export type { CreateClientOptions } from "./p2pClient.js";
export { P2PDhtClient } from "./p2pClient.js";