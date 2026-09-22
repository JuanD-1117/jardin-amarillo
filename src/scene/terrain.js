import * as THREE from 'three/webgpu';
import { ruidoFractal } from '../core/random.js';

/**
 * Altura del terreno en coordenadas de mundo.
 *
 * Es la única fuente de verdad: la malla del suelo y la colocación de cada
 * girasol llaman a esta misma función. Si divergen, las flores flotan o se
 * hunden.
 *
 * @param {number} x  metros
 * @param {number} z  metros
 * @returns {number}  altura en metros
 */
export function alturaTerreno(x, z) {
  const ondulacionAmplia = ruidoFractal(x * 0.012, z * 0.012, 3) * 2.6;
  const detalle = ruidoFractal(x * 0.09, z * 0.09, 2) * 0.22;
  return ondulacionAmplia + detalle;
}

/** Desviación lateral del sendero a una profundidad z dada. */
export function centroSendero(z) {
  return Math.sin(z * 0.075) * 5.5 + Math.sin(z * 0.021) * 2.5;
}

/** Semiancho del sendero; se ensancha al fondo para guiar la mirada. */
export function anchoSendero(z) {
  return 1.5 + Math.max(0, z) * 0.012;
}

export function crearTerreno(nivel) {
  const lado = nivel.radioCampo * 2.8;
  const geometria = new THREE.PlaneGeometry(lado, lado, nivel.segmentosTerreno, nivel.segmentosTerreno);
  geometria.rotateX(-Math.PI / 2);

  const posiciones = geometria.attributes.position;
  for (let i = 0; i < posiciones.count; i++) {
    const x = posiciones.getX(i);
    const z = posiciones.getZ(i);
    posiciones.setY(i, alturaTerreno(x, z));
  }
  posiciones.needsUpdate = true;
  geometria.computeVertexNormals();

  const material = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x4a3f27),
    roughness: 1.0,
    metalness: 0.0
  });

  const malla = new THREE.Mesh(geometria, material);
  malla.name = 'terreno';
  malla.receiveShadow = false;
  return malla;
}
