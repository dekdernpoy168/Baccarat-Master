export interface Env {
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return new Response(
      JSON.stringify({
        message: "KV removed",
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } 
};
