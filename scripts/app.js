import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("viewer");

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0xf6f8fa, 1); // ★ 背景を白に固定
container.appendChild(renderer.domElement);

// === Scene & Camera ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f8fa); // ★ 背景を白に固定
const camera = new THREE.PerspectiveCamera(45, container.clientWidth/container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === Lights ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// === Nodes Sample ===
const nodes = [
  { id: "a", label: "Alpha", description: "最初の概念ノード", tags: ["start","concept"], pos:[-1,0,0], color: 0x3366cc },
  { id: "b", label: "Beta", description: "次の概念ノード", tags: ["next","concept"], pos:[1,0,0], color: 0x33aa66 }
];
const nodeMeshes = {};

for (const n of nodes) {
  const geom = new THREE.SphereGeometry(0.2, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: n.color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(...n.pos);
  mesh.userData = n;
  scene.add(mesh);
  nodeMeshes[n.id] = mesh;
}

// === Edge Sample ===
const edgeGeom = new THREE.BufferGeometry().setFromPoints([
  nodeMeshes["a"].position,
  nodeMeshes["b"].position
]);
const edgeLine = new THREE.Line(edgeGeom, new THREE.LineBasicMaterial({ color: 0x888888 }));
scene.add(edgeLine);

// === Raycaster for Node Click ===
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

// === Update Sidepanel ===
function showNodeInfo(d) {
  document.getElementById("node-info").innerHTML = `
    <div><b>ID:</b> ${d.id}</div>
    <div><b>Label:</b> ${d.label}</div>
    <div><b>Description:</b> ${d.description}</div>
    <div><b>Tags:</b> ${d.tags.join(", ")}</div>
  `;
}

// === Render Loop ===
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// === Resize ===
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
