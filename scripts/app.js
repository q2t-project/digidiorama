import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== 基本セットアップ =====
const container = document.getElementById("viewer");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf5f7f9); // 白背景固定
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ライト
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ===== データセット（固定サンプル） =====
const datasets = {
  sample1: {
    meta: { title: "Sample 1", author: "Author A", created: "2025-09-14", tags: ["demo"] },
    nodes: [
      { id: "a", label: "Alpha", description: "最初の概念ノード", tags: ["start", "concept"], pos: [-1, 0, 0], color: 0x3366cc },
      { id: "b", label: "Beta", description: "次の概念ノード", tags: ["next", "concept"], pos: [1, 0, 0], color: 0x228844 }
    ],
    edges: [{ source: "a", target: "b" }]
  },
  sample2: {
    meta: { title: "Sample 2", author: "Author B", created: "2025-09-15", tags: ["example"] },
    nodes: [
      { id: "a", label: "Alpha", description: "最初のノード", tags: ["start"], pos: [-0.5, -0.5, 0], color: 0x990000 },
      { id: "b", label: "Beta", description: "次のノード", tags: ["example"], pos: [0.5, 0.5, 0], color: 0x000099 }
    ],
    edges: [{ source: "a", target: "b" }]
  }
};

// ===== ノード・エッジ描画 =====
let nodeMeshes = [];
let currentData = null;

function loadDataset(name) {
  // クリア
  nodeMeshes.forEach(m => scene.remove(m));
  scene.traverse(obj => { if (obj.type === "Line") scene.remove(obj); });
  nodeMeshes = [];

  const data = datasets[name];
  currentData = data;

  // メタ表示
  document.getElementById("meta").innerHTML = `
    <p><b>Title:</b> ${data.meta.title}</p>
    <p><b>Author:</b> ${data.meta.author}</p>
    <p><b>Created:</b> ${data.meta.created}</p>
    <p><b>Tags:</b> ${data.meta.tags.join(", ")}</p>
  `;

  // ノード
  for (const node of data.nodes) {
    const geom = new THREE.SphereGeometry(0.15, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: node.color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...node.pos);
    mesh.userData = node;
    scene.add(mesh);
    nodeMeshes.push(mesh);
  }

  // エッジ
  for (const edge of data.edges) {
    const s = data.nodes.find(n => n.id === edge.source);
    const t = data.nodes.find(n => n.id === edge.target);
    if (s && t) {
      const points = [new THREE.Vector3(...s.pos), new THREE.Vector3(...t.pos)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x444444 }));
      scene.add(line);
    }
  }

  // バリデーション（簡易）
  validateDataset(data);
}

// ===== バリデーション =====
function validateDataset(data) {
  const errors = [];
  if (!data.nodes || data.nodes.length === 0) {
    errors.push("ノードが存在しません");
  }
  for (const node of data.nodes) {
    if (!node.id) errors.push("ノードにIDがありません");
    if (!node.label) errors.push(`ノード ${node.id} にラベルがありません`);
  }
  document.getElementById("errors").innerHTML =
    errors.length ? errors.map(e => `<div>${e}</div>`).join("") : "<em>エラーなし</em>";
}

// ===== クリック選択 =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("click", event => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodeMeshes);
  if (intersects.length > 0) {
    const node = intersects[0].object.userData;
    showNodeInfo(node);
  }
});

function showNodeInfo(node) {
  const panel = document.getElementById("node-info");
  panel.innerHTML = `
    <p><b>ID:</b> ${node.id}</p>
    <p><b>Label:</b> ${node.label}</p>
    <p><b>Description:</b> ${node.description || ""}</p>
    <p><b>Tags:</b> ${node.tags?.join(", ") || ""}</p>
  `;
}

// ===== イベント =====
document.getElementById("datasetSelect").addEventListener("change", e => {
  loadDataset(e.target.value);
});

// 初期ロード
loadDataset("sample1");

// ===== レンダリングループ =====
function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
tick();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Ajvを初期化 ===
const ajv = new window.Ajv();
let schema = null;

// スキーマをロード（最初に一回だけ）
fetch("schemas/digidiorama.schema.json")
  .then(r => r.json())
  .then(s => { schema = s; });

// データ読み込み時に呼び出す部分
fetch(manifestUrl)
  .then(r => r.json())
  .then(data => {
    // ノード描画処理
    renderGraph(data);

    // バリデーション実行
    validateDataset(data);
  });  

function validateDataset(data) {
  const panel = document.getElementById("errors");
  if (!schema) {
    panel.innerHTML = "<em>Schema未ロード</em>";
    return;
  }

  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (valid) {
    panel.innerHTML = "<em>エラーなし</em>";
  } else {
    panel.innerHTML = validate.errors
      .map(e => `<div>${e.instancePath} ${e.message}</div>`)
      .join("");
  }
}
