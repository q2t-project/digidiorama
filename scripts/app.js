import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== 基本セットアップ =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("viewer").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 照明
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ===== 管理用配列 =====
const objects = [];
const objectGroup = new THREE.Group();
scene.add(objectGroup);

// ===== DOM 参照 =====
const nodeInfoEl = document.getElementById("node-info");

// ===== デバッグユーティリティ =====
const DEBUG = true;
const log = (...args) => DEBUG && console.log(...args);

// ===== manifest 読み込み =====
async function loadManifest(url = "assets/manifest.json") {
  const u = `${url}?v=${Date.now()}`; // キャッシュ殺し
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  const txt = await res.text();
  log("[M1 raw]", txt.slice(0, 200));
  const data = JSON.parse(txt);
  log("[M2 parsed nodes]", data.nodes);
  return data;
}

// ===== ノード追加 =====
function addNode(n) {
  log("[N1 input]", n);

  const g = new THREE.SphereGeometry(n.size ?? 0.1, 32, 16);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(n.color ?? "#3b82f6"),
  });
  const mesh = new THREE.Mesh(g, m);
  const [x, y, z] = n.pos ?? n.position ?? [0, 0, 0];
  mesh.position.set(x, y, z);

  // 全属性を userData にコピー
  mesh.userData = { kind: "node", ...n };

  log("[N2 userData]", mesh.userData);
  objectGroup.add(mesh);
  return mesh;
}

// ===== ノード選択時の処理 =====
function selectNode(mesh) {
  const d = mesh.userData;

  const root = document.getElementById("node-info");
  if (!root) {
    console.error("#node-info が見つかりません");
    return;
  }

  // 中身をクリアして差し替え
  root.replaceChildren();

  const addRow = (label, value) => {
    const row = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = label + ": ";
    const span = document.createElement("span");
    span.textContent = value;
    row.appendChild(b);
    row.appendChild(span);
    root.appendChild(row);
  };

  addRow("ID", d.id ?? "");
  addRow("Label", d.label ?? "");
  addRow("Description", d.description ?? "");
  addRow("Tags", Array.isArray(d.tags) ? d.tags.join(", ") : "");
}

// ===== Raycaster によるクリック判定 =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);
  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    selectNode(mesh);
    // 選択ノードの強調表示
    mesh.material.emissive = new THREE.Color(0x441111);
    mesh.scale.set(1.3, 1.3, 1.3);
  }
}

renderer.domElement.addEventListener("click", onClick);

// ===== エントリーポイント =====
async function init() {
  try {
    const data = await loadManifest("assets/manifest.json");
    log("[I1 manifest loaded]", data);

    // ノードを追加
    data.nodes.forEach((n) => {
      const mesh = addNode(n);
      scene.add(mesh);
      objects.push(mesh);
    });

    // エッジ（links）がある場合
    if (Array.isArray(data.links)) {
      data.links.forEach((l) => {
        const src = objects.find((o) => o.userData.id === l.source);
        const tgt = objects.find((o) => o.userData.id === l.target);
        if (src && tgt) {
          const points = [src.position, tgt.position];
          const g = new THREE.BufferGeometry().setFromPoints(points);
          const m = new THREE.LineBasicMaterial({ color: "#999" });
          scene.add(new THREE.Line(g, m));
        }
      });
    }

    tick();
  } catch (e) {
    console.error("init failed:", e);
  }
}

// ===== レンダリングループ =====
function tick() {
  console.log("tick"); // デバッグ用
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}

init();

// ===== リサイズ対応 =====
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);
