import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

// ライト
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const objects = [];

// ノード追加
function addNode(n) {
  const g = new THREE.SphereGeometry(n.size ?? 0.1, 32, 16);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(n.color ?? "#3b82f6") });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(...(n.pos ?? [0, 0, 0]));
  mesh.userData = { ...n };
  scene.add(mesh);
  objects.push(mesh);
  return mesh;
}

// ノード選択処理
function selectNode(mesh) {
  const d = mesh.userData;
  const root = document.getElementById("node-info");
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

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);
  if (intersects.length > 0) {
    selectNode(intersects[0].object);
  }
}
renderer.domElement.addEventListener("click", onClick);

// サンプルノード
addNode({
  id: "a",
  label: "Alpha",
  description: "最初の概念ノード",
  tags: ["start", "concept"],
  pos: [0, 0, 0],
  color: "#60a5fa"
});
addNode({
  id: "b",
  label: "Beta",
  description: "次の概念ノード",
  tags: ["next", "concept"],
  pos: [1.2, 0.4, -0.6],
  color: "#34d399"
});

// レンダリングループ
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
