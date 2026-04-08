import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export interface Env {
  KV: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      // Serve static assets from KV or similar
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.KV,
        }
      );
    } catch (e) {
      // Fallback to index.html if asset not found
      return new Response(
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="google-site-verification" content="KQ4DIHE73BVElXnH3clJoKn_eXg6ESqD_zY-gN8_OG4" />
    <meta name="description" content="คู่มือการเล่น บาคาร่า ปี 2026 เจาะลึกสอนทุกขั้นตอนตั้งแต่พื้นฐานถึงสูตรทำเงินระดับเซียน พร้อมกลยุทธ์เด็ดที่ช่วยเพิ่มโอกาสชนะให้คุณแบบมืออาชีพ" />
    <link rel="icon" type="image/png" href="https://img2.pic.in.th/LOGO1-Baccarat-Master.th.png" />
    <title>คู่มือการเล่น บาคาร่า ฉบับสมบูรณ์ ปี 2026 เจาะลึกทุกกลยุทธ์</title>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-MF2D8QZ7B5"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-MF2D8QZ7B5');
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }
  },
};
