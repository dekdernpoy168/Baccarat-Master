import { WorkerEntrypoint } from "cloudflare:workers";

export default class WorkerB extends WorkerEntrypoint {
  async fetch(request: Request) {
    return new Response("Worker B is running", { status: 200 });
  }

  async add(a: number, b: number) {
    return a + b;
  }
}
