import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Carga del girasol generado en Blender.
 *
 * El .glb sale de `blender/generate_sunflower.py` y contiene cinco nodos
 * (tallo, hoja_baja, hoja_alta, disco, petalos) sin materiales: el color se
 * asigna aquí, por nombre de nodo, y se hornea en un atributo de vértice.
 *
 * Así el campo entero cabe en una sola BufferGeometry y por tanto en una
 * sola llamada de dibujo, y la paleta se puede ajustar sin reexportar.
 */

/** Altura del girasol en unidades locales. El script la normaliza a 1,0 m. */
export const ALTURA_GIRASOL = 1.0;

const RUTA_MODELO = `${import.meta.env.BASE_URL}models/sunflower.glb`;

const PALETA = {
  tallo: new THREE.Color(0x4a6526),
  hoja: new THREE.Color(0x5b7a2e),
  discoCentro: new THREE.Color(0x3d2410),
  discoBorde: new THREE.Color(0x7d5418),
  petaloBase: new THREE.Color(0xd9901f),
  petaloPunta: new THREE.Color(0xfcc63f)
};

/** Decide la paleta de un nodo a partir de su nombre. */
function familiaDe(nombre) {
  if (nombre.startsWith('tallo')) return 'tallo';
  if (nombre.startsWith('hoja')) return 'hoja';
  if (nombre.startsWith('disco')) return 'disco';
  if (nombre.startsWith('petalos')) return 'petalos';
  throw new Error(
    `El modelo trae un nodo sin paleta asignada: "${nombre}". ` +
    'Añádelo a familiaDe() en src/scene/sunflower.js o renómbralo en el script de Blender.'
  );
}

/**
 * Escribe el atributo `color` de una parte.
 *
 * Disco y pétalos reciben un degradado radial: el disco se aclara hacia el
 * borde y el pétalo hacia la punta. Ese degradado es casi todo lo que separa
 * una flor de un recorte de cartulina cuando no hay texturas.
 */
function pintarParte(geometria, familia) {
  const posiciones = geometria.attributes.position;
  const cuenta = posiciones.count;
  const colores = new Float32Array(cuenta * 3);

  const plano = ['disco', 'petalos'].includes(familia);
  let ejeX = 0;
  let ejeZ = 0;
  let radioMaximo = 1;

  if (plano) {
    geometria.computeBoundingBox();
    const caja = geometria.boundingBox;
    ejeX = (caja.min.x + caja.max.x) / 2;
    ejeZ = (caja.min.z + caja.max.z) / 2;
    radioMaximo = Math.max(
      1e-6,
      Math.hypot(caja.max.x - ejeX, caja.max.z - ejeZ)
    );
  }

  const color = new THREE.Color();

  for (let i = 0; i < cuenta; i++) {
    switch (familia) {
      case 'tallo':
        color.copy(PALETA.tallo);
        break;
      case 'hoja':
        color.copy(PALETA.hoja);
        break;
      case 'disco': {
        const radio = Math.hypot(posiciones.getX(i) - ejeX, posiciones.getZ(i) - ejeZ);
        color.copy(PALETA.discoCentro).lerp(PALETA.discoBorde, Math.min(1, radio / radioMaximo));
        break;
      }
      case 'petalos': {
        const radio = Math.hypot(posiciones.getX(i) - ejeX, posiciones.getZ(i) - ejeZ);
        color.copy(PALETA.petaloBase).lerp(PALETA.petaloPunta, Math.min(1, radio / radioMaximo));
        break;
      }
    }

    colores[i * 3 + 0] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  }

  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
}

/** Deja solo los atributos que el material usa, para poder fusionar. */
function podarAtributos(geometria) {
  for (const nombre of Object.keys(geometria.attributes)) {
    if (!['position', 'normal', 'color'].includes(nombre)) {
      geometria.deleteAttribute(nombre);
    }
  }
}

/**
 * Carga el .glb y devuelve una única BufferGeometry con atributo `color`,
 * con la base del tallo en el origen y la punta en ALTURA_GIRASOL.
 */
export async function cargarGeometriaGirasol() {
  const cargador = new GLTFLoader();
  const gltf = await cargador.loadAsync(RUTA_MODELO);

  const partes = [];
  gltf.scene.updateMatrixWorld(true);

  gltf.scene.traverse((nodo) => {
    if (!nodo.isMesh) return;

    const geometria = nodo.geometry.clone();
    // El nodo puede traer transformaciones propias; se hornean en la malla.
    geometria.applyMatrix4(nodo.matrixWorld);

    podarAtributos(geometria);
    pintarParte(geometria, familiaDe(nodo.name));
    partes.push(geometria);
  });

  if (partes.length === 0) {
    throw new Error(`El modelo ${RUTA_MODELO} no contiene mallas. Reejecuta blender/generate_sunflower.py.`);
  }

  const girasol = mergeGeometries(partes, false);
  for (const parte of partes) parte.dispose();

  if (girasol === null) {
    throw new Error('No se pudieron fusionar las partes del girasol: atributos incompatibles entre nodos del .glb.');
  }

  girasol.computeVertexNormals();
  return girasol;
}
