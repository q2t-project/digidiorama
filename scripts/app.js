// Three.js 読み込み
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ========== DOM参照 ==========
const container = document.getElementById('viewer');
const picker = document.getElementById('data-picker');
const reloadBtn = document.getElementById('reload');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const errorsEl = document.getElementById('errors');

function setStatus(msg) { statusEl.textContent = msg; }
function showMeta(m) {
  metaEl.innerHTML = `
    <div><b>title:</b> ${m.title ?? ''}</div>
    <div><b>author:</b> ${m.author ?? ''}</div>
    <div><b>created:</b> ${m.created ?? ''}</div>
    <div><b>tags:</b> ${(m.tags ?? []).join(', ')}</div>
  `;
}
function showError(err) {
  errorsEl.textContent = err.message || String(err);
}

// ========== Three.js 基本セットアップ ==========
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

// ガイド
scene.add(new THREE.GridHelper(10, 10, 0x8aa7ff, 0xdbe5ff));
scene.add(new THREE.AxesHelper(1.2));
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3, 5, 2);
scene.add(dir);

// ========== JSONロード関連 ==========
async function loadManifest() {
  const res = await fetch('assets/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error("manifest fetch failed");
  return res.json();
}

async function loadData(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error("data fetch failed");
  return res.json(); // P1ではAJVは省略し最低限
}

// ノード描画
function drawNodes(nodes = []) {
  // 既存ノード削除
  scene.children = scene.children.filter(obj => obj.userData?.kind !== 'node');
  for (const n of nodes) {
    const s = n.size ?? 0.06;
    const geo = new THREE.SphereGeometry(s, 24, 16);
    const mat = new THREE.MeshStandardMaterial({ color: n.color ?? '#5aa9e6' });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...n.position);
    mesh.userData = { kind: 'node', id: n.id };
    scene.add(mesh);
  }
}

// メイン起動
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
    showError(err);
    setStatus("Error");
  }
}

async function loadAndShow(fileUrl) {
  try {
    setStatus("Loading data…");
    errorsEl.textContent = '';
    const data = await loadData(fileUrl);
    showMeta(data.meta ?? {});
    drawNodes(data.nodes ?? []);
    setStatus("Loaded");
  } catch (err) {
    showError(err);
    setStatus("Error");
  }
}

// イベント
picker.addEventListener('change', () => loadAndShow(picker.value));
reloadBtn.addEventListener('click', () => loadAndShow(picker.value));

// ========== ループ & リサイズ ==========
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
(function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

// GO
init();
