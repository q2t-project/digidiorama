import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// === シーン基本設定 ===
const container = document.getElementById('viewer');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight-48);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// === 照明 ===
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// === データサンプル ===
const nodes = [
  { id: "a", label: "Alpha", description: "最初の概念ノード", tags: ["start","concept"], pos:[-1,0,0], color: 0x3366cc },
  { id: "b", label: "Beta", description: "次の概念ノード", tags: ["next","concept"], pos:[1,0,0], color: 0x33aa66 }
];
const edges = [
  { source: "a", target: "b" }
];

// === ノード描画 ===
const nodeMeshes = {};
for (const node of nodes) {
  const geometry = new THREE.SphereGeometry(0.2, 32, 32);
  const material = new THREE.MeshStandardMaterial({ color: node.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...node.pos);
  mesh.userData = node;
  scene.add(mesh);
  nodeMeshes[node.id] = mesh;
}

// === エッジ描画 ===
for (const e of edges) {
  const src = nodeMeshes[e.source];
  const dst = nodeMeshes[e.target];
  if (src && dst) {
    const points = [src.position, dst.position];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888 }));
    scene.add(line);
  }
}

// === Raycasterでクリック判定 ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(Object.values(nodeMeshes));
  if (intersects.length > 0) {
    selectNode(intersects[0].object);
  }
}
renderer.domElement.addEventListener('click', onClick);

// === ノード選択処理 ===
function selectNode(mesh) {
  const d = mesh.userData;
  document.getElementById("node-info").innerHTML = `
    <div><b>ID:</b> ${d.id}</div>
    <div><b>Label:</b> ${d.label ?? ""}</div>
    <div><b>Description:</b> ${d.description ?? ""}</div>
    <div><b>Tags:</b> ${(d.tags ?? []).join(", ")}</div>
  `;
}

// === 初期メッセージ ===
document.getElementById("node-info").innerHTML = "ノードをクリックしてください";

// === レンダリングループ ===
function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / (window.innerHeight-48);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight-48);
});
