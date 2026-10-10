const storeName = "wefold-gallery";

async function store() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(storeName);
}

export default async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const blobs = await store();

  if (request.method === "GET" && id) {
    const html = await blobs.get(id, { type: "text" });
    if (!html) return new Response("Not found", { status: 404 });
    if (id === "latest-sheets") return new Response(html, { headers: { "content-type": "application/json" } });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (request.method === "GET") {
    const list = await blobs.list();
    const items = await Promise.all((list.blobs || []).map(async (blob) => {
      const meta = await blobs.getMetadata(blob.key);
      return { id: blob.key, name: (meta && meta.metadata && meta.metadata.name) || blob.key, updated: blob.uploadedAt || "" };
    }));
    return Response.json(items);
  }

  if (request.method === "POST") {
    const body = await request.json();
    const name = String(body.name || "WEfold-2.0").replace(/[^\w.-]+/g, "-");
    await blobs.set(name, body.html || "", { metadata: { name } });
    if (body.sheets) await blobs.set("latest-sheets", JSON.stringify(body.sheets), { metadata: { name: "latest-sheets" } });
    return Response.json({ id: name, url: "/g/" + name });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    for (const name of body.ids || []) await blobs.delete(String(name));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
