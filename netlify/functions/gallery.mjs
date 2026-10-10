const storeName = "wefold-gallery";
const repo = "moriphoto/3ddisplay";

async function store() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(storeName);
}

async function saveToGitHub(name, html) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return false;
  const path = `assets/gallery/${name}.html`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  const existing = await fetch(api, { headers });
  const sha = existing.ok ? (await existing.json()).sha : undefined;
  const response = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Save ${name} to the gallery`,
      content: btoa(unescape(encodeURIComponent(html))),
      branch: "main",
      sha
    })
  });
  return response.ok;
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
    const items = (list.blobs || [])
      .filter((blob) => blob.key !== "latest-sheets" && blob.key !== "test-board")
      .map((blob) => ({ id: blob.key, name: blob.key, url: "/g/" + blob.key }));
    return Response.json(items);
  }

  if (request.method === "POST") {
    const body = await request.json();
    const name = String(body.name || "WEfold-2.0").replace(/[^\w.-]+/g, "-");
    await blobs.set(name, body.html || "", { metadata: { name } });
    const github = await saveToGitHub(name, body.html || "");
    return Response.json({ id: name, url: "/g/" + name, github, file: "assets/gallery/" + name + ".html" });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    for (const name of body.ids || []) await blobs.delete(String(name));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
