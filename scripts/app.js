import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const el = document.getElementById("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f9fc);

const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000);
camera.position.set(2.5, 2, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(el.clientWidth, el.clientHeight);
el.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;

const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(3, 4, 5);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6, metalness: 0.1 });
const cube = new THREE.Mesh(geo, mat);
scene.add(cube);

function onResize() {
  const { clientWidth: w, clientHeight: h } = el;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", onResize);

function tick() {
  cube.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
onResize();
tick();
