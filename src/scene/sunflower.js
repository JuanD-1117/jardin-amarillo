import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Girasol de sustitución para V0.1.
 *
 * Deliberadamente tosco: el objetivo de esta versión no es que la flor sea
 * bonita, sino validar la cadena instancias + viento en TSL + despliegue.
 * En V0.2 esta geometría se reemplaza por el modelo exportado de Blender
 * (glTF + Draco) sin tocar nada más: el resto del código solo necesita una
 * BufferGeometry con atributo `color` y altura ALTURA_GIRASOL.
 */

/** Altura del tallo en unidades locales. El viento normaliza contra ella. */
export const ALTURA_GIRASOL = 1.0;

const VERDE_TALLO = new THREE.Color(0x4f6b2a);
const VERDE_HOJA = new THREE.Color(0x5f7d31);
const MARRON_DISCO = new THREE.Color(0x4a2f16);
const AMARILLO_PETALO = new THREE.Color(0xf0b429);

/** Añade un atributo `color` constante para que las partes se puedan fusionar. */
function pintar(geometria, color) {
  const cuenta = geometria.attributes.position.count;
  const colores = new Float32Array(cuenta * 3);
  for (let i = 0; i < cuenta; i++) {
    colores[i * 3 + 0] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  return geometria;
}

function crearTallo() {
  const tallo = new THREE.CylinderGeometry(0.016, 0.03, ALTURA_GIRASOL, 5, 3);
  tallo.translate(0, ALTURA_GIRASOL / 2, 0);
  return pintar(tallo, VERDE_TALLO);
}

function crearHoja(altura, giro, inclinacion) {
  const hoja = new THREE.PlaneGeometry(0.3, 0.13, 1, 1);
  hoja.translate(0.15, 0, 0);
  hoja.rotateZ(inclinacion);
  hoja.rotateY(giro);
  hoja.translate(0, altura, 0);
  return pintar(hoja, VERDE_HOJA);
}

function crearCabeza(numeroPetalos) {
  const partes = [];

  const disco = new THREE.CircleGeometry(0.105, Math.max(8, numeroPetalos));
  partes.push(pintar(disco, MARRON_DISCO));

  const largoPetalo = 0.17;
  for (let i = 0; i < numeroPetalos; i++) {
    const angulo = (i / numeroPetalos) * Math.PI * 2;
    const petalo = new THREE.PlaneGeometry(0.06, largoPetalo, 1, 2);
    // Pivote en la base del pétalo para que nazca del borde del disco.
    petalo.translate(0, largoPetalo / 2 + 0.07, 0);
    // Los pétalos alternos se abren un poco más hacia el frente.
    petalo.rotateX(i % 2 === 0 ? -0.18 : -0.07);
    petalo.rotateZ(angulo);
    partes.push(pintar(petalo, AMARILLO_PETALO));
  }

  const cabeza = mergeGeometries(partes, false);
  for (const parte of partes) parte.dispose();

  // La cabeza mira al sol: inclinada hacia +Z y ligeramente hacia abajo.
  cabeza.rotateX(0.32);
  cabeza.translate(0, ALTURA_GIRASOL - 0.02, 0.03);
  return cabeza;
}

/**
 * Construye la geometría completa del girasol en una sola BufferGeometry
 * para que todo el campo se dibuje con una única llamada de dibujo.
 */
export function crearGeometriaGirasol(numeroPetalos = 14) {
  const partes = [
    crearTallo(),
    crearHoja(0.34, 0.6, 0.25),
    crearHoja(0.58, 3.3, 0.15),
    crearCabeza(numeroPetalos)
  ];

  const girasol = mergeGeometries(partes, false);
  for (const parte of partes) parte.dispose();

  girasol.computeVertexNormals();
  return girasol;
}
