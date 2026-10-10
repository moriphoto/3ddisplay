const storeName = "wefold-gallery";
const repo = "moriphoto/3ddisplay";

async function store() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(storeName);
}

async function saveToGitHub(name, html) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, reason: "GITHUB_TOKEN is not available to the function." };
  if (!token.startsWith("github_pat_") && !token.startsWith("ghp_")) return { ok: false, reason: "The value is not a GitHub token." };
  const path = `assets/gallery/${name}.html`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "wefold-gallery" };
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
  if (response.ok) return { ok: true };
  return { ok: false, reason: "GitHub returned " + response.status + "." };
}

async function deleteFromGitHub(name) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;
  const path = `assets/gallery/${name}.html`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "wefold-gallery" };
  const existing = await fetch(api, { headers });
  if (!existing.ok) return;
  const sha = (await existing.json()).sha;
  await fetch(api, { method: "DELETE", headers, body: JSON.stringify({ message: `Remove ${name} from the gallery`, sha, branch: "main" }) });
}
function showPage(title, ids) {
  const boards = JSON.stringify(ids);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#f6f3ee;color:#1c1c1c;font-family:Helvetica,Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px}p{margin:0;letter-spacing:.12em;font-size:12px;color:#6d6a64}button{border:0;background:#1c1c1c;color:#fff;border-radius:999px;padding:8px 14px}iframe{width:100%;height:calc(100vh - 64px);border:0;background:#f7f5f0}</style>
</head><body><header><p>WORLDENTIRE · ${title}</p><div><button id="prev" type="button">Previous</button> <span id="count"></span> <button id="next" type="button">Next</button></div></header>
<iframe id="frame"></iframe><script>
const boards=${boards};let i=0;
function show(){document.getElementById("frame").src="/.netlify/functions/gallery?id="+encodeURIComponent(boards[i]);document.getElementById("count").textContent=(i+1)+" / "+boards.length;}
document.getElementById("prev").onclick=()=>{i=(i-1+boards.length)%boards.length;show();};
document.getElementById("next").onclick=()=>{i=(i+1)%boards.length;show();};
addEventListener("keydown",(e)=>{if(e.key==="ArrowRight")document.getElementById("next").click();if(e.key==="ArrowLeft")document.getElementById("prev").click();});
show();
</script></body></html>`;
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

  if (request.method === "GET" && url.searchParams.get("shows") === "1") {
    const list = await blobs.list();
    const items = (list.blobs || []).filter((blob) => blob.key.startsWith("show-")).map((blob) => ({ id: blob.key, name: blob.key.replace(/^show-/, "") }));
    return Response.json(items);
  }

  if (request.method === "GET") {
    const list = await blobs.list();
    const items = (list.blobs || [])
      .filter((blob) => !["latest-sheets", "test-board", "token-check"].includes(blob.key) && !blob.key.startsWith("show-"))
      .map((blob) => ({ id: blob.key, name: blob.key, url: "/g/" + blob.key }));
    return Response.json(items);
  }

  if (request.method === "POST") {
    const body = await request.json();
    if (body.type === "slideshow") {
      const title = String(body.name || "Show").replace(/[^\w .-]+/g, "").trim() || "Show";
      const id = "show-" + title.replace(/[^\w.-]+/g, "-");
      const html = showPage(title, body.ids || []);
      await blobs.set(id, html, { metadata: { name: title } });
      const github = await saveToGitHub(id, html);
      return Response.json({ id, url: "/.netlify/functions/gallery?id=" + id, github: github.ok });
    }
    const name = String(body.name || "WEfold-2.0").replace(/[^\w.-]+/g, "-");
    await blobs.set(name, body.html || "", { metadata: { name } });
    const github = await saveToGitHub(name, body.html || "");
    return Response.json({ id: name, url: "/.netlify/functions/gallery?id=" + name, github: github.ok, reason: github.reason || "", file: "assets/gallery/" + name + ".html" });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    for (const name of body.ids || []) {
      await blobs.delete(String(name));
      await deleteFromGitHub(String(name));
    }
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
