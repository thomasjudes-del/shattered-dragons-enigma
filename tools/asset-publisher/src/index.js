export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const key = decodeURIComponent(url.pathname.slice('/assets/'.length));
      const object = await env.ASSETS.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(object.body, { headers });
    }

    if (request.method !== 'PUT' || !url.pathname.startsWith('/publish/')) {
      return Response.json({ ok:false, error:'Use PUT /publish/<key> or GET /assets/<key>' }, { status:405 });
    }

    const token = request.headers.get('authorization');
    if (!env.PUBLISH_TOKEN || token !== `Bearer ${env.PUBLISH_TOKEN}`) {
      return Response.json({ ok:false, error:'Unauthorized' }, { status:401 });
    }

    const key = decodeURIComponent(url.pathname.slice('/publish/'.length));
    if (!key || key.includes('..')) return Response.json({ok:false,error:'Invalid key'},{status:400});

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const body = await request.arrayBuffer();
    if (body.byteLength < 100000) {
      return Response.json({ok:false,error:'Rejected: suspiciously small asset',bytes:body.byteLength},{status:422});
    }

    const digest = await crypto.subtle.digest('SHA-256', body);
    const sha256 = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');

    await env.ASSETS.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: { sha256 }
    });

    return Response.json({
      ok:true,
      key,
      bytes:body.byteLength,
      sha256,
      url:`${url.origin}/assets/${encodeURI(key)}`
    });
  }
};
