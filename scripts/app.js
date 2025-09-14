// --- imports（Import Maps 前提） ---
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Ajv from "ajv"; // 事前importmapで "ajv": "+esm" を解決

// --- DOM refs ---
const container = document.getElementById('viewer');
const picker = document.getElementById('data-picker');
const reloadBtn = document.getElementById('reload');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const nodeEl = document.getElementById('node');
const errorsEl = document.getElementById('errors');
const layerPanel = document.getElementById('layer-panel');

const setStatus = (msg) => { statusEl.textContent = msg; };
const showError = (err) => {
  errorsEl.textContent = err?.validation || err?.message || String(err || "");
  errorsEl.focus();
};
const showMeta = (m = {}) => {
  metaEl.innerHTML = `
    <div><b>title:</b> ${m.title ?? ""}</div>
    <div><b>author:</b> ${m.author ?? ""}</div>
    <div><b>created:</b> ${m.created ?? ""}</div>
    <div><b>tags:</b> ${(m.tags ?? []).join(", ")}</div>
  `;
};
const showNode = (n) => {
  if (!n) { nodeEl.innerHTML = ""; return; }
  nodeEl.innerHTML = `
    <div><b>id:</b> ${n.id ?? ""}</div>
    <div><b>label:</b> ${n.label ?? ""}</div>
    <div><b>description:</b> ${n.description ?? "(なし)"}</div>
    <div><b>tags:</b> ${(n.tags ?? []).join(", ")}</div>
    ${Array.isArray(n.links) && n.links.length
      ? `<div><b>links:</b> ${n.links.map(x=>`<a href="${x}" target="_blank" rel="noreferrer noopener">${x}</a>`).join(", ")}</div>`
      : ""
    }
  `;
};

// --- URL utils ---
const getQuery = () => new URL(window.location.href).searchParams;
const q = getQuery();

// --- Three.js setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f8fb');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  55,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(2.5, 1.8, 2.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// guides
const gridHelper = new THREE.GridHelper(10, 10, 0x8aa7ff, 0xdbe5ff);
gridHelper.position.y = -0.001;
scene.add(gridHelper);
scene.add(new THREE.AxesHelper(1.2));
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3, 5, 2);
scene.add(dir);

// --- Layers state ---
const layersState = new Map([
  ['grid',  true],
  ['nodes', true],
]);
// UI（デフォルト）を反映
function syncLayerUIFromState() {
  for (const input of layerPanel.querySelectorAll('input[type="checkbox"][data-layer]')) {
    input.checked = !!layersState.get(input.dataset.layer);
  }
}
function applyLayerVisibility() {
  gridHelper.visible = !!layersState.get('grid');
  // nodes は nodeGroup の可視制御（後述）
  nodeGroup.visible = !!layersState.get('nodes');
}

// --- Data schema（P1は最小） ---
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'digigiorama(min)',
  type: 'object',
  required: ['version','meta','nodes'],
  properties: {
    version: { type: 'string' },
    meta: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        author: { type: 'string' },
        created:{ type: 'string' },
        tags:   { type: 'array', items: { type: 'string' } }
      }
    },
    space: { type: 'object' },
    layers:{ type: 'array' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id','label','position'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          position: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
          color: { type: 'string' },
          size:  { type: 'number' },
          tags:  { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          links: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    edges:  { type: 'array' },
    models: { type: 'array' }
  }
};
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

// --- manifest / data loader ---
async function loadManifest(url = 'assets/manifest.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return res.json();
}
async function loadDigigiorama(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`data fetch failed: ${res.status}`);
  const data = await res.json();
  const ok = validate(data);
  if (!ok) {
    const err = new Error('schema validation failed');
    err.validation = ajv.errorsText(validate.errors, { separator: '\n' });
    throw err;
  }
  return data;
}

// --- Nodes group / selection ---
const nodeGroup = new THREE.Group();
scene.add(nodeGroup);
const nodeMeshes = [];
let selected = null;

function clearNodes() {
  for (const m of nodeMeshes) nodeGroup.remove(m);
  nodeMeshes.length = 0;
  selected = null;
  showNode(null);
}
function makeNodeMesh(n) {
  const size = n.size ?? 0.06;
  const color = n.color ?? '#5aa9e6';
  const geo = new THREE.SphereGeometry(size, 24, 16);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...n.position);
  mesh.userData = { kind: 'node', data: n, baseColor: color, baseScale: size };
  return mesh;
}
function drawNodes(nodes = []) {
  clearNodes();
  for (const n of nodes) {
    const m = makeNodeMesh(n);
    nodeMeshes.push(m);
    nodeGroup.add(m);
  }
  applyLayerVisibility(); // nodes の可視状態を反映
}
function unhighlight(m) {
  if (!m) return;
  if (m.material && m.userData?.baseColor) m.material.color.set(m.userData.baseColor);
  m.scale.set(1,1,1);
}
function highlight(m) {
  if (!m) return;
  if (m.material) m.material.color.offsetHSL(0, 0, -0.2); // 少し暗く
  m.scale.set(1.3, 1.3, 1.3);
}

// --- Picking ---
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(nodeMeshes, false);
  return hits[0]?.object || null;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return; // 左クリックのみ
  const obj = pick(e.clientX, e.clientY);
  if (obj && obj.userData?.kind === 'node') {
    if (selected !== obj) {
      unhighlight(selected);
      selected = obj;
      highlight(selected);
      showNode(selected.userData.data);
      // 将来用イベント: window.dispatchEvent(new CustomEvent('node:click', { detail: selected.userData.data }));
    }
  } else {
    unhighlight(selected);
    selected = null;
    showNode(null);
  }
});

// --- Layer UI wiring ---
layerPanel.addEventListener('change', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === 'checkbox' && t.dataset.layer) {
    layersState.set(t.dataset.layer, t.checked);
    applyLayerVisibility();
    // 将来用イベント: window.dispatchEvent(new CustomEvent('layer:toggle', { detail: { id: t.dataset.layer, visible: t.checked } }));
  }
});

// --- Viewer API（骨格） ---
export const viewer = {
  async load(jsonUrl) {
    setStatus('Loading data…');
    errorsEl.textContent = '';
    const data = await loadDigigiorama(jsonUrl);
    showMeta(data.meta ?? {});
    // layers[] が来たらUIをデータ駆動で再構成（id/order/visible）※P1簡略
    if (Array.isArray(data.layers) && data.layers.length) {
      // 左UI再生成（grid/nodes 既定は維持しつつ、重複は上書き）
      const known = new Set(['grid','nodes']);
      layerPanel.innerHTML = '<h3>Layers</h3>';
      // まず既定2つ
      for (const id of ['grid','nodes']) {
        const vis = (id === 'grid') ? layersState.get('grid') : layersState.get('nodes');
        layerPanel.insertAdjacentHTML('beforeend',
          `<label><input type="checkbox" data-layer="${id}" ${vis ? 'checked':''}> ${id}</label>`);
      }
      // データ側の追加
      for (const layer of data.layers) {
        if (!layer?.id) continue;
        if (known.has(layer.id)) {
          layersState.set(layer.id, !!layer.visible);
          continue;
        }
        layersState.set(layer.id, !!layer.visible);
        layerPanel.insertAdjacentHTML('beforeend',
          `<label><input type="checkbox" data-layer="${layer.id}" ${layer.visible ? 'checked':''}> ${layer.id}</label>`);
        known.add(layer.id);
      }
      // 変更イベントを拾えるよう、リスナは親に付けっぱなしでOK
      syncLayerUIFromState();
    }
    // nodes 描画
    drawNodes(data.nodes ?? []);
    setStatus('Loaded');
    // 将来用イベント: window.dispatchEvent(new CustomEvent('load:success', { detail: { url: jsonUrl } }));
  },

  focus(nodeId) {
    const m = nodeMeshes.find(x => x.userData?.data?.id === nodeId);
    if (!m) return false;
    // 簡易フォーカス：カメラを対象の少し上空へ
    const p = m.position.clone();
    camera.position.lerp(new THREE.Vector3(p.x + 0.8, p.y + 0.8, p.z + 0.8), 0.6);
    controls.target.copy(p);
    controls.update();
    return true;
  },

  snapshot() {
    // 最小：表示中ファイル（picker.value）、レイヤ、カメラ/ターゲット
    const u = new URL(window.location.href);
    u.searchParams.set('file', picker.value || '');
    u.searchParams.set('layers', JSON.stringify(Object.fromEntries(layersState)));
    u.searchParams.set('cam', JSON.stringify({ p: camera.position, t: controls.target }));
    return u.toString();
  }
};

// --- Boot flow ---
async function init() {
  try {
    setStatus('Loading manifest…');
    const manifest = await loadManifest();
    // picker 構築
    picker.innerHTML = '';
    for (const entry of manifest) {
      const opt = document.createElement('option');
      opt.value = entry.file;
      opt.textContent = entry.title || entry.file;
      picker.appendChild(opt);
    }
    // ?file= 優先
    const fileFromQuery = q.get('file');
    if (fileFromQuery && [...picker.options].some(o => o.value === fileFromQuery)) {
      picker.value = fileFromQuery;
    }
    // 起動ロード
    if (picker.value) {
      await viewer.load(picker.value);
    }
    setStatus('Ready');
  } catch (err) {
    showError(err);
    setStatus('Error');
    // 将来用: window.dispatchEvent(new CustomEvent('load:error', { detail: err }));
  }
}

// UI events
picker.addEventListener('change', () => viewer.load(picker.value));
reloadBtn.addEventListener('click', () => viewer.load(picker.value));

// resize & loop
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

(function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

// go
init();
