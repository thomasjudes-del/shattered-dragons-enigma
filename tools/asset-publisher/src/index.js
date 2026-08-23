import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function createServer(env) {
  const server = new McpServer({ name: "Confluence Asset Publisher", version: "1.0.0" });

  server.registerTool(
    "publish_asset",
    {
      description: "Publish an image or other binary asset to the Confluence of Minds R2 bucket and return its public Worker URL.",
      inputSchema: {
        key: z.string().min(1).describe("R2 object key, for example shattered-dragons/scene.jpg"),
        base64: z.string().min(1).describe("Complete file bytes encoded as base64"),
        contentType: z.string().default("application/octet-stream").describe("MIME type, for example image/jpeg"),
      },
    },
    async ({ key, base64, contentType }) => {
      if (key.includes("..") || key.startsWith("/")) throw new Error("Invalid key");
      const bytes = decodeBase64(base64);
      if (bytes.byteLength === 0) throw new Error("Empty asset");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      await env.ASSETS.put(key, bytes, {
        httpMetadata: { contentType },
        customMetadata: { sha256 },
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ok: true, key, bytes: bytes.byteLength, sha256, path: `/assets/${encodeURI(key)}` }),
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
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/mcp") {
      return createMcpHandler(() => createServer(env))(request, env, ctx);
    }

    return Response.json({ ok: true, service: "Confluence Asset Publisher", mcp: "/mcp" });
  },
};
