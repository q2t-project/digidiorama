// Three.js をCDNからESMで直接読み込み（バンドラ不要）
// CDNからthree.jsをESMで読み込み
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";




const container = document.getElementById('viewer');

// ===== 基本セットアップ =====
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f8fb'); // ライト基調

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // dPR上限で負荷コントロール
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// 視体（カメラ）
const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(2.5, 1.8, 2.5);

// 操作（回転・移動・ズーム）
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ===== ガイド（グリッド／軸） =====
const grid = new THREE.GridHelper(10, 10, 0x8aa7ff, 0xdbe5ff); // 青系（アクセント）
grid.position.y = -0.001;
scene.add(grid);

const axes = new THREE.AxesHelper(1.2);
axes.material.depthTest = false; // 前面に出しやすく
scene.add(axes);

// ===== ライティング（最低限） =====
const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3, 5, 2);
scene.add(dir);

// ===== デモ用の最小ジオメトリ（起動確認） =====
// ※ P1ではJSON表示は未着手。動作確認のための仮オブジェクトです。
{
  const geo = new THREE.SphereGeometry(0.25, 32, 16);
  const mat = new THREE.MeshStandardMaterial({ color: '#5aa9e6', roughness: 0.5, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.25, 0);
  scene.add(mesh);
}

// ===== リサイズ対応 =====
function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ===== ループ =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ===== アクセシビリティ：キーボードで軽く操作 =====
// 矢印キーでターゲット・カメラを微移動（最小）
window.addEventListener('keydown', (e) => {
  const step = 0.1;
  switch (e.key) {
    case 'ArrowUp':   controls.target.y += step; break;
    case 'ArrowDown': controls.target.y -= step; break;
    case 'ArrowLeft': controls.target.x -= step; break;
    case 'ArrowRight':controls.target.x += step; break;
    case 'g': case 'G': grid.visible = !grid.visible; break; // 仕様のショートカット一部先取り
    case 'r': case 'R': // リセット
      controls.reset();
      camera.position.set(2.5, 1.8, 2.5);
      break;
    default: return;
  }
  controls.update();
});
