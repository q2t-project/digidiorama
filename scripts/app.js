import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const el = document.getElementById("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f9fc);

// ========== DOM参照 ==========
const container = document.getElementById('viewer');
const nodeInfoEl = document.getElementById('node-info');
const errorsEl = document.getElementById('errors');

// ===== i18n 辞書 =====
const i18nDict = {
  ja: { title: "digidiorama", loading: "読み込み中…" },
  en: { title: "digidiorama", loading: "Loading…" }
};

function applyI18n(lang) {
  const dict = i18nDict[lang] ?? i18nDict.ja;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
}

const langSel = document.getElementById("lang");
langSel.addEventListener("change", () => applyI18n(langSel.value));
applyI18n(langSel.value);

const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000);
camera.position.set(2.5, 2, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(el.clientWidth, el.clientHeight);
el.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;

// ライト
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(3, 4, 5);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

// ===== P1: manifestのロード & 表示 =====
const objectGroup = new THREE.Group();
scene.add(objectGroup);

async function loadManifest(url = "assets/manifest.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return res.json();
}

function addNode(n) {
  const r = n.size ?? 0.1;
  const c = new THREE.Color(n.color ?? "#3b82f6");
  const g = new THREE.SphereGeometry(r, 32, 16);
  const m = new THREE.MeshStandardMaterial({ color: c });
  const mesh = new THREE.Mesh(g, m);
  const [x, y, z] = n.pos ?? [0, 0, 0];
  mesh.position.set(x, y, z);

  // 🔽 全属性を userData にコピー
  mesh.userData = { kind: 'node', ...n };

  objectGroup.add(mesh);
  return mesh;
}


function addEdge(e, nodesById) {
  const a = nodesById.get(e.source);
  const b = nodesById.get(e.target);
  if (!a || !b) return;

  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(e.color ?? "#64748b"),
    linewidth: e.width ?? 1
  });
  const geom = new THREE.BufferGeometry().setFromPoints([
    a.position.clone(),
    b.position.clone()
  ]);
  const line = new THREE.Line(geom, mat);
  objectGroup.add(line);
}

loadManifest()
  .then(data => {
    const nodesById = new Map();
    (data.nodes ?? []).forEach(n => {
      const mesh = addNode(n);
      nodesById.set(n.id, mesh);
    });
    (data.edges ?? []).forEach(e => addEdge(e, nodesById));
  })
  .catch(err => console.error(err));

// ===== レンダリングループ =====
function onResize() {
  const { clientWidth: w, clientHeight: h } = el;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", onResize);

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Raycasterとマウス座標
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 選択状態を管理
let selectedNode = null;
let originalMaterial = null;

// クリック時の処理
function onClick(event) {
  // canvasの座標系に正規化
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);

  const hit = intersects.find(obj => obj.object.userData?.kind === 'node');
  if (hit) {
    selectNode(hit.object);
  }
}

// ノード選択処理
function selectNode(mesh) {
  // 前の選択をリセット
  if (selectedNode && originalMaterial) {
    selectedNode.material = originalMaterial;
    selectedNode.scale.set(1, 1, 1);
  }

  // 新しい選択
  selectedNode = mesh;
  originalMaterial = mesh.material;

  // 強調表示（赤色＋拡大）
  mesh.material = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0x441111,
    roughness: 0.4
  });
  mesh.scale.set(1.3, 1.3, 1.3);

  // ノード情報を右パネルに表示
  const d = mesh.userData;
document.getElementById("node-info").innerHTML = `
  <div><b>ID:</b> ${d.id ?? ""}</div>
  <div><b>Label:</b> ${d.label ?? ""}</div>
  <div><b>Description:</b> ${d.description ?? ""}</div>
  <div><b>Tags:</b> ${(d.tags ?? []).join(", ")}</div>
`;
}


// イベント登録
renderer.domElement.addEventListener('click', onClick);

onResize();
tick();

// ==== DEBUGスイッチ ====
const DEBUG = true;
const log = (...args) => DEBUG && console.log(...args);
const assert = (cond, msg) => { if (!cond) { throw new Error("ASSERT: " + msg); } };

// ===== DOM =====
const nodeInfoEl = document.getElementById("node-info");
const errorsEl   = document.getElementById("errors");

// ===== manifest 読み込み（キャッシュ殺す）=====
async function loadManifest(url = "assets/manifest.json") {
  const u = `${url}?v=${Date.now()}`;
  const res = await fetch(u, { cache: "no-store" });
  const txt = await res.text();
  log("[M1 raw]", txt.slice(0, 200) + (txt.length > 200 ? "..." : ""));
  const data = JSON.parse(txt);
  log("[M2 parsed nodes]", data.nodes);
  // 変化点#1: ファイル→パース
  assert(Array.isArray(data.nodes), "nodes が配列でない");
  return data;
}

// ===== ノード追加 =====
function addNode(n) {
  // 変化点#2: 受け取った n の中身
  log("[N1 input]", n);

  const g = new THREE.SphereGeometry(n.size ?? 0.1, 32, 16);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(n.color ?? "#3b82f6") });
  const mesh = new THREE.Mesh(g, m);
  const [x, y, z] = n.pos ?? [0, 0, 0];
  mesh.position.set(x, y, z);

  // ここが一番疑わしい箇所。全属性を丸ごと埋める
  mesh.userData = { kind: "node", ...n };

  // 変化点#3: userData に想定属性が入ったか
  log("[N2 userData]", mesh.userData);
  assert("label" in mesh.userData, "userData.label 無し");
  assert("description" in mesh.userData, "userData.description 無し（manifest側かaddNode側）");
  return mesh;
}

// ===== クリック → パネル表示 =====
function selectNode(mesh) {
  const d = mesh.userData;
  // 変化点#4: 選択直後の userData
  log("[S1 selected userData]", d);

  // パネル更新（innerHTML → 文字化け/タグ化を避けるため textContent を使う）
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

  // 変化点#5: パネルに実際入ったか
  log("[S2 panel text]", {
    id: document.getElementById("nf-id").textContent,
    label: document.getElementById("nf-label").textContent,
    desc: document.getElementById("nf-desc").textContent,
    tags: document.getElementById("nf-tags").textContent
  });
}

// ====== 既存の流れの中に上の関数を組み込むだけ ======
/*
  - loadManifest() で取得
  - nodes をループして addNode(n) → scene/add
  - クリック時 selectNode(mesh)
*/
