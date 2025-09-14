// scripts/app.js

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== 固定サンプルデータ =====
const sampleData = {
  meta: {
    title: "Sample 1",
    author: "Author A",
    created: "2025-09-15",
    tags: ["example"]
  },
  nodes: [
    { id: "a", label: "Alpha", description: "最初の概念ノード", tags: ["start", "concept"], color: 0x3366cc },
    { id: "b", label: "Beta", description: "次の概念ノード", tags: ["next", "concept"], color: 0x228844 }
  ],
  edges: [
    { source: "a", target: "b" }
  ]
};

// ===== シーン初期化 =====
const container = document.getElementById("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f7fa); // 白背景

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// コントロール
const controls = new OrbitControls(camera, renderer.domElement);

// ===== ノードとエッジ描画 =====
const nodeMeshes = {};
function renderGraph(data) {
  // 既存オブジェクトをクリア
  for (const obj of [...scene.children]) {
    if (obj.isMesh || obj.isLine) scene.remove(obj);
  }

  // ノード
  data.nodes.forEach(node => {
    const geometry = new THREE.SphereGeometry(0.3, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: node.color || 0x666666 });
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, 0);
    sphere.userData = node;

    scene.add(sphere);
    nodeMeshes[node.id] = sphere;
  });

  // エッジ
  data.edges.forEach(edge => {
    const src = nodeMeshes[edge.source];
    const tgt = nodeMeshes[edge.target];
    if (src && tgt) {
      const points = [src.position, tgt.position];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x444444 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    }
  });

  // 簡易ライト
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x888888));
}

// ===== パネル更新 =====
function updateMetaPanel(meta) {
  document.getElementById("meta").innerHTML = `
    <b>Title:</b> ${meta.title}<br>
    <b>Author:</b> ${meta.author}<br>
    <b>Created:</b> ${meta.created}<br>
    <b>Tags:</b> ${meta.tags.join(", ")}
  `;
}

function updateNodeInfoPanel(node) {
  if (!node) {
    document.getElementById("node-info").innerHTML = "<em>ノードをクリックしてください</em>";
    return;
  }
  document.getElementById("node-info").innerHTML = `
    <b>ID:</b> ${node.id}<br>
    <b>Label:</b> ${node.label}<br>
    <b>Description:</b> ${node.description}<br>
    <b>Tags:</b> ${node.tags.join(", ")}
  `;
}

function updateErrorsPanel(errors) {
  document.getElementById("errors").innerHTML =
    errors.length ? errors.map(e => `<div>${e}</div>`).join("") : "<em>エラーなし</em>";
}

// ===== 簡易バリデーション =====
function validateDataset(data) {
  const errors = [];
  if (!data.nodes || data.nodes.length === 0) {
    errors.push("ノードが存在しません");
  }
  for (const node of data.nodes) {
    if (!node.id) errors.push("ノードにIDがありません");
    if (!node.label) errors.push(`ノード ${node.id} にラベルがありません`);
  }
  updateErrorsPanel(errors);
}

// ===== レイキャストによるクリック検出 =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Object.values(nodeMeshes));

  if (intersects.length > 0) {
    const node = intersects[0].object.userData;
    updateNodeInfoPanel(node);
  }
}

renderer.domElement.addEventListener("click", onClick);

// ===== 初期化 =====
renderGraph(sampleData);
updateMetaPanel(sampleData.meta);
updateNodeInfoPanel(null);
validateDataset(sampleData);

// ===== ループ =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
