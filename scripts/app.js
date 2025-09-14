// ===== manifest 読み込み =====
async function loadManifest(url = "assets/manifest.json") {
  const u = `${url}?v=${Date.now()}`;
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  const txt = await res.text();
  log("[M1 raw]", txt.slice(0, 200));
  const data = JSON.parse(txt);
  log("[M2 parsed nodes]", data.nodes);
  return data;
}

function addNode(n) {
  log("[N1 input]", n);
  const g = new THREE.SphereGeometry(n.size ?? 0.1, 32, 16);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(n.color ?? "#3b82f6") });
  const mesh = new THREE.Mesh(g, m);
  const [x, y, z] = n.pos ?? n.position ?? [0, 0, 0]; // ← schema対応
  mesh.position.set(x, y, z);

  mesh.userData = { kind: "node", ...n };
  log("[N2 userData]", mesh.userData);
  return mesh;
}

function selectNode(mesh) {
  const d = mesh.userData;
  log("[S1 selected userData]", d);

  nodeInfoEl.innerHTML = `
    <div><b>ID:</b> <span id="nf-id"></span></div>
    <div><b>Label:</b> <span id="nf-label"></span></div>
    <div><b>Description:</b> <span id="nf-desc"></span></div>
    <div><b>Tags:</b> <span id="nf-tags"></span></div>
  `;
  document.getElementById("nf-id").textContent    = d.id ?? "";
  document.getElementById("nf-label").textContent = d.label ?? "";
  document.getElementById("nf-desc").textContent  = d.description ?? "";
  document.getElementById("nf-tags").textContent  = Array.isArray(d.tags) ? d.tags.join(", ") : "";
}
