import './ui/styles.css';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { elegirNivel, nivelForzado } from './core/quality.js';
import { crearTerreno, alturaTerreno, centroSendero } from './scene/terrain.js';
import { crearCampo } from './scene/field.js';
import { crearIluminacion } from './scene/lighting.js';
import { crearIntro } from './ui/intro.js';

/** Cielo de hora dorada. La niebla usa el mismo color para que el campo funda. */
const COLOR_CIELO = new THREE.Color(0xdca85f);

const lienzo = document.getElementById('lienzo');

let renderer;
let escena;
let camara;
let controles;

function ajustarTamano() {
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();
  renderer.setSize(ancho, alto, false);
}

async function construir() {
  renderer = new THREE.WebGPURenderer({ canvas: lienzo, antialias: true });
  await renderer.init();

  const nivel = nivelForzado() ?? elegirNivel(renderer);
  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, nivel.pixelRatioMax));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  escena = new THREE.Scene();
  escena.background = COLOR_CIELO;
  escena.fog = new THREE.Fog(COLOR_CIELO, nivel.nieblaCerca, nivel.nieblaLejos);

  camara = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

  // La cámara arranca a la entrada del sendero, a altura de persona.
  const zInicial = -nivel.radioCampo * 0.88;
  const xInicial = centroSendero(zInicial);
  camara.position.set(xInicial, alturaTerreno(xInicial, zInicial) + 1.55, zInicial);

  escena.add(crearTerreno(nivel));
  const { malla, total } = crearCampo(nivel);
  escena.add(malla);
  crearIluminacion(escena);

  controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.minDistance = 0.8;
  controles.maxDistance = 30;
  // Impide que la cámara se meta bajo el terreno.
  controles.maxPolarAngle = Math.PI * 0.495;
  const zObjetivo = zInicial + 6;
  controles.target.set(centroSendero(zObjetivo), alturaTerreno(xInicial, zObjetivo) + 1.2, zObjetivo);
  controles.update();

  window.addEventListener('resize', ajustarTamano);

  // Compilar antes de mostrar evita el tirón del primer fotograma.
  await renderer.compileAsync(escena, camara);

  console.info(`[jardin] backend=${backend} nivel=${nivel.nombre} girasoles=${total}`);
  return { nivel, total, backend };
}

function dibujar() {
  controles.update();
  renderer.render(escena, camara);
}

const intro = crearIntro({
  alEntrar() {
    renderer.setAnimationLoop(dibujar);
  }
});

construir().then(intro.listo).catch(intro.fallar);
