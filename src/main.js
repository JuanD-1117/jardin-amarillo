import './ui/styles.css';
import * as THREE from 'three/webgpu';

import { elegirNivel, nivelForzado } from './core/quality.js';
import { crearExperiencia, ESTADO } from './core/experience.js';
import { crearTerreno, alturaTerreno } from './scene/terrain.js';
import { crearCampo } from './scene/field.js';
import { crearAtmosfera } from './scene/atmosphere.js';
import { crearMovimiento } from './interaction/movement.js';
import { crearMensajes } from './ui/messages.js';
import { crearIntro } from './ui/intro.js';

const lienzo = document.getElementById('lienzo');
const botonAvanzar = document.getElementById('avanzar');

const reloj = new THREE.Clock();

let renderer;
let escena;
let camara;
let atmosfera;
let experiencia;

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
  escena.background = new THREE.Color(0x000000);
  escena.fog = new THREE.Fog(0x000000, nivel.nieblaCerca, nivel.nieblaLejos);

  camara = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);

  escena.add(crearTerreno(nivel));
  const { malla, total, corazon } = await crearCampo(nivel);
  escena.add(malla);

  atmosfera = crearAtmosfera(escena, nivel);

  const movimiento = crearMovimiento({
    lienzo,
    boton: botonAvanzar,
    alturaSuelo: alturaTerreno,
    radioLimite: nivel.radioCampo * 0.97
  });

  const mensajes = crearMensajes();

  experiencia = crearExperiencia({
    camara, escena, nivel, corazon, atmosfera, movimiento, mensajes
  });

  window.addEventListener('resize', ajustarTamano);

  // Compilar antes de mostrar evita el tirón del primer fotograma.
  await renderer.compileAsync(escena, camara);

  if (new URLSearchParams(location.search).has('debug')) {
    window.__jardin = {
      renderer, escena, camara, nivel, corazon, atmosfera, experiencia,
      /** Teletransporta al corazón para disparar la revelación sin caminar. */
      irAlCorazon() {
        camara.position.set(corazon.centroX, alturaTerreno(0, corazon.centroZ) + 1.55, corazon.centroZ);
      }
    };
  }

  console.info(`[jardin] backend=${backend} nivel=${nivel.nombre} girasoles=${total}`);
  return { nivel, total, backend };
}

function dibujar() {
  const delta = Math.min(reloj.getDelta(), 0.05);

  experiencia.actualizar(delta);
  atmosfera.seguirCamara(camara);

  // El botón táctil solo tiene sentido mientras el visitante lleva el mando.
  botonAvanzar.classList.toggle('visible', experiencia.estado === ESTADO.PASEO);

  renderer.render(escena, camara);
}

const intro = crearIntro({
  alEntrar() {
    reloj.getDelta();
    renderer.setAnimationLoop(dibujar);
  }
});

construir().then(intro.listo).catch(intro.fallar);
