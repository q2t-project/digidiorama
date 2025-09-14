import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Ajv2020 from "ajv2020";

// --- DOM refs ---
const picker     = document.getElementById('data-picker');
const reloadBtn  = document.getElementById('reload');
const langPicker = document.getElementById('lang-picker');
const statusEl   = document.getElementById('status');
const metaEl     = document.getElementById('meta');
const nodeEl     = document.getElementById('node');
const errorsEl   = document.getElementById('errors');
const layerPanel = document.getElementById('layer-panel');

// モバイルUI
const btnLayers = document.getElementById('btn-layers');
const btnNode   = document.getElementById('btn-node');
const btnErrors = document.getElementById('btn-errors');
const modal     = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const modalClose   = document.getElementById('modal-close');

// ---------- 状態表示 ----------
const setStatus = (msg) => { statusEl.textContent = msg; };
const showError = (err) => {
  errorsEl.textContent = err?.validation || err?.message || String(err || "");
  if (errorsEl.textContent) errorsEl.focus();
};
const showMeta = (m = {}) => {
  metaEl.innerHTML = `
    <div><b>${t('title')}:</b> ${m.title ?? ""}</div>
    <div><b>${t('author')}:</b> ${m.author ?? ""}</div>
    <div><b>${t('created')}:</b> ${m.created ?? ""}</div>
    <div><b>${t('tags')}:</b> ${(m.tags ?? []).join(", ")}</div>
  `;
};
const showNode = (n) => {
  if (!n) { nodeEl.innerHTML = ""; return; }
  nodeEl.innerHTML = `
    <div><b>id:</b> ${n.id ?? ""}</div>
    <div><b>${t('label')}:</b> ${n.label ?? ""}</div>
    <div><b>${t('description')}:</b> ${n.description ?? t('(なし)')}</div>
    <div><b>${t('tags')}:</b> ${(n.tags ?? []).join(", ")}</div>
    ${Array.isArray(n.links) && n.links.length
      ? `<div><b>links:</b> ${n.links.map(x=>`<a href="${x}" target="_blank" rel="noreferrer noopener">${x}</a>`).join(", ")}</div>`
      : ""
    }
  `;
};

// ---------- URL helpers ----------
const url = new URL(window.location.href);
const q   = url.searchParams;
const getQP = (key, fallback=null) => q.get(key) ?? fallback;
const setQP = (key, val) => { if (val==null) q.delete(key); else q.set(key, val); };

// ---------- i18n ----------
let I18N = { lang: 'ja', dict: {} };
async function loadI18n(lang) {
  const res = await fetch(`assets/i18n/${lang}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`i18n load failed: ${lang}`);
  I18N = { lang, dict: await res.json() };
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  }
  document.documentElement.lang = lang;
}
const t = (k) => I18N.dict[k] ?? k;

// ---------- Three.js 初期化 ----------
const container = window.innerWidth >= 768
  ? document.getElementById('viewer')
  : document.getElementById('viewer-mobile');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f8fb');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(2.5, 1.8, 2.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Guides
const gridHelper = new THREE.GridHelper(10, 10, 0x7ea4ff, 0xcfe0ff);
gridHelper.position.y = -0.001;
scene.add(gridHelper);
scene.add(new THREE.AxesHelper(1.2));
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3, 5, 2);
scene.add(dir);

// ---------- レイヤー ----------
const layersState = new Map([['grid',true], ['nodes',true]]);
const syncLayerUIFromState = () => {
  for (const input of layerPanel.querySelectorAll('input[type="checkbox"][data-layer]')) {
    input.checked = !!layersState.get(input.dataset.layer);
  }
};
const applyLayerVisibility = () => {
  gridHelper.visible = !!layersState.get('grid');
  nodeGroup.visible  = !!layersState.get('nodes');
};
layerPanel.addEventListener('change', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === 'checkbox' && t.dataset.layer) {
    layersState.set(t.dataset.layer, t.checked);
    applyLayerVisibility();
  }
});

// ---------- Schema ----------
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
let validate = null;
async function ensureValidator() {
  if (validate) return validate;
  const res = await fetch('assets/schema/digidiorama-schema.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('schema fetch failed');
  const schema = await res.json();
  validate = ajv.compile(schema);
  return validate;
}

// ---------- Data Loader ----------
async function loadManifest(url='assets/manifest.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return res.json();
}
async function loadDigidiorama(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`data fetch failed: ${res.status}`);
  const data = await res.json();
  const v = await ensureValidator();
  const ok = v(data);
  if (!ok) {
    const err = new Error('schema validation failed');
    err.validation = ajv.errorsText(v.errors, { separator: '\n' });
    throw err;
  }
  return data;
}

// ---------- Nodes / Picking ----------
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
  const color = n.color ?? '#3969d6';
  const geo = new THREE.SphereGeometry(size, 24, 16);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...n.position);
  mesh.userData = { kind:'node', data:n, baseColor:color, baseScale:size };
  return mesh;
}
function drawNodes(nodes=[]) {
  clearNodes();
  for (const n of nodes) {
    const m = makeNodeMesh(n);
    nodeMeshes.push(m);
    nodeGroup.add(m);
  }
  applyLayerVisibility();
}
function unhighlight(m){ if(!m) return; if(m.material) m.material.color.set(m.userData.baseColor); m.scale.set(1,1,1); }
function highlight(m){ if(!m) return; if(m.material) m.material.color.offsetHSL(0,0,-0.2); m.scale.set(1.3,1.3,1.3); }

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
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const obj = pick(e.clientX, e.clientY);
  if (obj && obj.userData?.kind === 'node') {
    if (selected !== obj) {
      unhighlight(selected);
      selected = obj;
      highlight(selected);
      showNode(selected.userData.data);
    }
  } else {
    unhighlight(selected);
    selected = null;
    showNode(null);
  }
});

// ---------- Viewer API ----------
export const viewer = {
  async load(jsonUrl) {
    setStatus('Loading data…');
    errorsEl.textContent = '';
    const data = await loadDigidiorama(jsonUrl);
    showMeta(data.meta ?? {});
    drawNodes(data.nodes ?? []);
    setStatus('Loaded');
  },
  focus(nodeId) {
    const m = nodeMeshes.find(x => x.userData?.data?.id === nodeId);
    if (!m) return false;
    const p = m.position.clone();
    camera.position.set(p.x+0.8, p.y+0.8, p.z+0.8);
    controls.target.copy(p); controls.update();
    return true;
  },
  snapshot() {
    const u = new URL(window.location.href);
    u.searchParams.set('file', picker.value || '');
    u.searchParams.set('layers', JSON.stringify(Object.fromEntries(layersState)));
    u.searchParams.set('cam', JSON.stringify({
      p:{x:camera.position.x,y:camera.position.y,z:camera.position.z},
      t:{x:controls.target.x,y:controls.target.y,z:controls.target.z}
    }));
    u.searchParams.set('lang', I18N.lang);
    return u.toString();
  }
};

// ---------- Boot ----------
async function init() {
  try {
    const lang = getQP('lang', 'ja');
    langPicker.value = lang;
    await loadI18n(lang);

    setStatus('Loading manifest…');
    const manifest = await loadManifest();

    picker.innerHTML = '';
    for (const entry of manifest) {
      const opt = document.createElement('option');
      opt.value = entry.file;
      opt.textContent = entry.title || entry.file;
      picker.appendChild(opt);
    }

    const fileFromQuery = getQP('file', null);
    if (fileFromQuery && [...picker.options].some(o => o.value === fileFromQuery)) {
      picker.value = fileFromQuery;
    }

    if (picker.value) await viewer.load(picker.value);
    setStatus('Ready');
  } catch (err) {
    showError(err); setStatus('Error');
  }
}

picker.addEventListener('change', () => viewer.load(picker.value));
reloadBtn.addEventListener('click', () => viewer.load(picker.value));
langPicker.addEventListener('change', async () => {
  await loadI18n(langPicker.value);
  setQP('lang', langPicker.value);
  history.replaceState(null, '', url.toString());
});

// Resize & loop
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

(function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

init();
