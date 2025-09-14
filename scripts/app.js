import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// === Viewer 初期化 ===
const container = document.getElementById("viewer");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0xf6f8fa, 1);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f8fa);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// === サンプルデータ ===
const datasets = {
  sample1: {
    meta: { title: "Sample 1", author: "Author A", created: "2025-09-01", tags: ["demo","test"] },
    nodes: [
      { id:"a", label:"Alpha", description:"最初のノード", tags:["start"], pos:[-1,0,0], color:0x3366cc },
      { id:"b", label:"Beta", description:"次のノード", tags:["next"], pos:[1,0,0], color:0x33aa66 }
    ],
    edges: [{ source:"a", target:"b" }]
  },
  sample2: {
    meta: { title: "Sample 2", author: "Author B", created: "2025-09-15", tags: ["example"] },
    nodes: [
      { id:"x", label:"Xray", description:"別のサンプルノード", tags:["alt"], pos:[-0.5,0,0], color:0xcc3333 },
      { id:"y", label:"Yankee", description:"その次", tags:["alt"], pos:[0.5,0,0], color:0x3333cc }
    ],
    edges: []
  }
};

let nodeMeshes = {};

// === ノード表示 ===
function renderDataset(ds) {
  // === 既存クリア ===
  for (const obj of [...Object.values(nodeMeshes), ...scene.children.filter(o => o.isLine)]) {
    scene.remove(obj);
  }
  nodeMeshes = {};

  // === ノード描画 ===
  ds.nodes.forEach(n => {
    const geom = new THREE.SphereGeometry(0.2, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: n.color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...n.pos);
    mesh.userData = n;
    scene.add(mesh);
    nodeMeshes[n.id] = mesh;
  });

  // === エッジ描画 ===
// === エッジ描画 ===
ds.edges.forEach(e => {
  const src = nodeMeshes[e.source];
  const tgt = nodeMeshes[e.target];
  if (src && tgt) {
    const points = [src.position.clone(), tgt.position.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x444444 });
    const line = new THREE.Line(geom, mat);
    scene.add(line);
  }
});


  // === Meta 更新 ===
  updateMeta(ds.meta);
  // Node Info 初期化
  document.getElementById("node-info").textContent = "ノードをクリックしてください";
}

// === パネル更新 ===
function updateMeta(meta) {
  document.getElementById("meta").innerHTML = `
    <div><b>Title:</b> ${meta.title}</div>
    <div><b>Author:</b> ${meta.author}</div>
    <div><b>Created:</b> ${meta.created}</div>
    <div><b>Tags:</b> ${(meta.tags ?? []).join(", ")}</div>
  `;
}

// === Raycaster ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener("click", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Object.values(nodeMeshes));
  if (intersects.length > 0) {
    showNodeInfo(intersects[0].object.userData);
  }
});

function showNodeInfo(d) {
  document.getElementById("node-info").innerHTML = `
    <div><b>ID:</b> ${d.id}</div>
    <div><b>Label:</b> ${d.label}</div>
    <div><b>Description:</b> ${d.description}</div>
    <div><b>Tags:</b> ${(d.tags ?? []).join(", ")}</div>
  `;
}

// === データ切替 ===
const datasetSelect = document.getElementById("dataset");
datasetSelect.addEventListener("change", () => {
  const val = datasetSelect.value;
  renderDataset(datasets[val]);
});

// 初期表示
renderDataset(datasets.sample1);

// === レンダリングループ ===
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// === リサイズ対応 ===
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
