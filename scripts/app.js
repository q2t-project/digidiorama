// Three.js 読み込み
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== DOM参照 =====
const container   = document.getElementById('viewer');
const picker      = document.getElementById('data-picker');
const reloadBtn   = document.getElementById('reload');
const statusEl    = document.getElementById('status');
const metaEl      = document.getElementById('meta');
const nodeDetailEl= document.getElementById('node-detail');
const errorsEl    = document.getElementById('errors');
const layersEl    = document.getElementById('layers');

function setStatus(msg) { statusEl.textContent = msg; }
function showMeta(m) {
  metaEl.innerHTML = `
    <div><b>title:</b> ${m.title ?? ''}</div>
    <div><b>author:</b> ${m.author ?? ''}</div>
    <div><b>created:</b> ${m.created ?? ''}</div>
    <div><b>tags:</b> ${(m.tags ?? []).join(', ')}</div>
  `;
}
function showError(err) { errorsEl.textContent = err.message || String(err); }

// ===== Three.js 基本セットアップ =====
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f8fb');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(2.5, 2, 2.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.zoomSpeed = 0.001;       // ズーム感度（1.0基準、0.5なら緩やか）
controls.minDistance = 0.001;  // 近づきすぎを防止
controls.maxDistance = 100;   // ズームアウトしすぎ防止
controls.target.set(0, 0, 0);

// 重要: ホイールを連続ズームにする
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

// ガイド系
const grid = new THREE.GridHelper(10, 10, 0x8aa7ff, 0xdbe5ff);
scene.add(grid);
const axes = new THREE.AxesHelper(1.2);
scene.add(axes);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3,5,2); scene.add(dir);

// ===== JSONロード関連 =====
async function loadManifest() {
  const res = await fetch('assets/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error("manifest fetch failed");
  return res.json();
}
async function loadData(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error("data fetch failed");
  return res.json(); // P1では簡易ロード
}

// ===== ノード描画 & レイヤ管理 =====
let sceneRefs = { grid, nodes: [] };
function drawNodes(nodes = []) {
  // 既存ノード削除
  sceneRefs.nodes.forEach(m => scene.remove(m));
  sceneRefs.nodes = [];

  for (const n of nodes) {
    const s = n.size ?? 0.06;
    const geo = new THREE.SphereGeometry(s, 24, 16);
    const mat = new THREE.MeshStandardMaterial({ color: n.color ?? '#5aa9e6' });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...n.position);
    mesh.userData = { kind: 'node', ...n, baseColor: mat.color.clone(), baseSize: s };
    scene.add(mesh);
    sceneRefs.nodes.push(mesh);
  }
}

function buildLayerPanel(layers) {
  layersEl.innerHTML = '';
  for (const layer of layers) {
    const id = `layer-${layer.id}`;
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = id; cb.checked = layer.visible;
    cb.addEventListener('change', () => toggleLayer(layer.id, cb.checked));
    label.appendChild(cb); label.append(` ${layer.id}`);
    layersEl.appendChild(label);
    layersEl.appendChild(document.createElement('br'));
    // 初期状態反映
    toggleLayer(layer.id, layer.visible);
  }
}
function toggleLayer(id, visible) {
  if (id === 'grid') {
    sceneRefs.grid.visible = visible;
  } else if (id === 'nodes') {
    (sceneRefs.nodes ?? []).forEach(m => m.visible = visible);
  }
  // TODO: models, labels, hud は将来追加
}

// ===== ノード選択処理 =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedNode = null;

function showNodeDetail(n) {
  let linksHtml = '';
  if (n.links && n.links.length > 0) {
    linksHtml = '<ul>' + n.links.map(u => `<li><a href="${u}" target="_blank">${u}</a></li>`).join('') + '</ul>';
  }
  nodeDetailEl.innerHTML = `
    <div><b>id:</b> ${n.id}</div>
    <div><b>label:</b> ${n.label ?? ''}</div>
    <div><b>tags:</b> ${(n.tags ?? []).join(', ')}</div>
    <div><b>description:</b><br><p>${n.description ?? ''}</p></div>
    <div><b>links:</b>${linksHtml}</div>
  `;
}
function selectNode(mesh) {
  if (selectedNode) {
    selectedNode.material.color.copy(selectedNode.userData.baseColor);
    selectedNode.scale.setScalar(1);
  }
  selectedNode = mesh;
  if (mesh) {
    mesh.material.color.set('#ff5722');
    mesh.scale.setScalar(1.3);
    showNodeDetail(mesh.userData);
  } else {
    nodeDetailEl.innerHTML = '';
  }
}
function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(sceneRefs.nodes, true);
  if (intersects.length > 0) {
    selectNode(intersects[0].object);
  } else {
    selectNode(null);
  }
}
renderer.domElement.addEventListener('click', onClick);

// ===== 起動処理 =====
async function init() {
  try {
    setStatus("Loading manifest…");
    const manifest = await loadManifest();
    picker.innerHTML = '';
    for (const entry of manifest) {
      const opt = document.createElement('option');
      opt.value = entry.file;
      opt.textContent = entry.title || entry.file;
      picker.appendChild(opt);
    }
    if (picker.options.length > 0) {
      await loadAndShow(picker.value);
    }
    setStatus("Ready");
  } catch (err) {
    showError(err); setStatus("Error");
  }
}
async function loadAndShow(fileUrl) {
  try {
    setStatus("Loading data…"); errorsEl.textContent = '';
    const data = await loadData(fileUrl);
    showMeta(data.meta ?? {});
    drawNodes(data.nodes ?? []);
    buildLayerPanel(data.layers ?? []);
    setStatus("Loaded");
  } catch (err) {
    showError(err); setStatus("Error");
  }
}
picker.addEventListener('change', () => loadAndShow(picker.value));
reloadBtn.addEventListener('click', () => loadAndShow(picker.value));

// ===== ループ & リサイズ =====
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
(function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

// GO
init();
