import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const manager = new THREE.LoadingManager();

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
let mixer;

const clock = new THREE.Clock();

// ✅ Movimiento inicial (debe existir como .fbx en models/fbx/)
const params = {
  asset: 'Idle',
};

// ✅ Lista de movimientos disponibles (nombres sin .fbx)
const assets = [
  'Idle',
  'Walking',
  'Running',
  'Jumping',
  'Samba Dancing',
];

init();

function init() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    2000
  );
  camera.position.set(100, 200, 300);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);
  scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.position.set(0, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 180;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.camera.left = -120;
  dirLight.shadow.camera.right = 120;
  scene.add(dirLight);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  loader = new FBXLoader(manager);
  loadAsset(params.asset);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.update();

  window.addEventListener('resize', onWindowResize);

  // stats
  stats = new Stats();
  container.appendChild(stats.dom);

  // GUI
  const gui = new GUI();
  gui.add(params, 'asset', assets).onChange((value) => {
    loadAsset(value);
  });

  guiMorphsFolder = gui.addFolder('Morphs').hide();

  // ✅ Teclas rápidas: 1..5 para cambiar movimiento
  window.addEventListener('keydown', (e) => {
    const map = {
      '1': assets[0], // Idle
      '2': assets[1], // Walking
      '3': assets[2], // Running
      '4': assets[3], // Jumping
      '5': assets[4], // Samba Dancing
    };

    if (map[e.key]) {
      params.asset = map[e.key];
      loadAsset(params.asset);
    }
  });
}

function loadAsset(asset) {
  loader.load(
    'models/fbx/' + asset + '.fbx',
    function (group) {
      // (Opcional) para debug:
      // console.log(asset, 'animaciones:', group.animations?.length);

      // Limpieza del modelo anterior
      if (object) {
        object.traverse(function (child) {
          if (child.isSkinnedMesh) child.skeleton.dispose();

          if (child.material) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((material) => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          }

          if (child.geometry) child.geometry.dispose();
        });

        scene.remove(object);
      }

      object = group;

      // Animación
      if (object.animations && object.animations.length) {
        mixer = new THREE.AnimationMixer(object);
        const action = mixer.clipAction(object.animations[0]);
        action.reset().play(); // ✅ reset para que arranque bien al cambiar
      } else {
        mixer = null;
      }

      // GUI morphs
      guiMorphsFolder.children.forEach((child) => child.destroy());
      guiMorphsFolder.hide();

      // Sombras + morphs
      object.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.morphTargetDictionary) {
            guiMorphsFolder.show();
            const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);

            Object.keys(child.morphTargetDictionary).forEach((key) => {
              meshFolder.add(
                child.morphTargetInfluences,
                child.morphTargetDictionary[key],
                0,
                1,
                0.01
              );
            });
          }
        }
      });

      scene.add(object);
    },
    undefined,
    (err) => {
      console.error('❌ Error cargando FBX:', asset, err);
    }
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  renderer.render(scene, camera);
  stats.update();
}