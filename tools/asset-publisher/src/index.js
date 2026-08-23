import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

function createServer(env) {
  const server = new McpServer({ name: "Confluence Asset Publisher", version: "1.1.0" });

  server.registerTool(
    "publish_asset",
    {
      description: "Publish an image or other file supplied by ChatGPT to the Confluence of Minds R2 bucket without recompressing it, then return its public Worker URL.",
      inputSchema: {
        key: z.string().min(1).describe("R2 object key, for example shattered-dragons/scene-06.png"),
        file: z.string().describe("File supplied by ChatGPT. Do not encode the file as base64."),
      },
      _meta: {
        "openai/fileParams": ["file"],
      },
    },
    async ({ key, file }) => {
      if (key.includes("..") || key.startsWith("/")) throw new Error("Invalid key");
      if (!file) throw new Error("No file supplied");

      const source = await fetch(file);
      if (!source.ok) throw new Error(`Unable to fetch supplied file: ${source.status}`);

      const body = await source.arrayBuffer();
      if (body.byteLength === 0) throw new Error("Empty asset");
      const contentType = source.headers.get("content-type") || "application/octet-stream";

      const digest = await crypto.subtle.digest("SHA-256", body);
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

      await env.ASSETS.put(key, body, {
        httpMetadata: { contentType },
        customMetadata: { sha256 },
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ok: true,
            key,
            bytes: body.byteLength,
            sha256,
            contentType,
            path: `/assets/${encodeURI(key)}`,
          }),
        }],
      };
    },
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
      const key = decodeURIComponent(url.pathname.slice("/assets/".length));
      const object = await env.ASSETS.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("access-control-allow-origin", "*");
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/mcp") {
      return createMcpHandler(() => createServer(env))(request, env, ctx);
    }

    return Response.json({ ok: true, service: "Confluence Asset Publisher", version: "1.1.0", mcp: "/mcp" });
  },
};
