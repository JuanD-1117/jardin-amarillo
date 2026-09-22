import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, positionLocal, mix, vec3, float } from 'three/tsl';
import { cargarGeometriaGirasol, ALTURA_GIRASOL } from './sunflower.js';
import { desplazamientoViento } from './wind.js';
import { alturaTerreno, centroSendero, anchoSendero } from './terrain.js';
import { geometriaCorazon, zonaCorazon, ZONA } from './heart.js';
import { crearRng } from '../core/random.js';

const SEMILLA_CAMPO = 20260921;

/**
 * Distribución del campo.
 *
 * Rejilla con jitter en lugar de posiciones puramente aleatorias: la rejilla
 * evita los huecos y los grumos del muestreo uniforme, y el jitter borra el
 * patrón regular.
 *
 * Tres reglas modulan la densidad:
 *   1. El borde se adelgaza, para que el campo no termine en un círculo
 *      recortado.
 *   2. El sendero es un vacío, no una textura encima.
 *   3. El corazón es más denso que el resto del campo.
 */
function calcularPosiciones(nivel, corazon) {
  const azar = crearRng(SEMILLA_CAMPO);
  const radio = nivel.radioCampo;
  const area = Math.PI * radio * radio;
  const lado = Math.sqrt(area / nivel.girasoles);

  const posiciones = [];
  const pasos = Math.ceil((radio * 2) / lado);

  for (let i = 0; i < pasos; i++) {
    for (let j = 0; j < pasos; j++) {
      const baseX = -radio + (i + 0.5) * lado;
      const baseZ = -radio + (j + 0.5) * lado;
      const x = baseX + (azar() - 0.5) * lado * 1.6;
      const z = baseZ + (azar() - 0.5) * lado * 1.6;

      const distancia = Math.hypot(x, z);
      if (distancia > radio) continue;

      const { zona, intensidad } = zonaCorazon(x, z, corazon);

      // El anillo de tierra despejada es lo que recorta la silueta desde el
      // aire. Sin él, el corazón es solo una mancha algo más densa.
      if (zona === ZONA.ANILLO) continue;

      // El sendero solo horada el campo fuera del corazón: al llegar al
      // corazón el camino se acaba y la silueta queda entera.
      if (zona === ZONA.FUERA) {
        const desviacion = Math.abs(x - centroSendero(z));
        if (desviacion < anchoSendero(z)) continue;
      }

      const t = Math.max(0, (distancia - radio * 0.72) / (radio * 0.28));
      const densidadBorde = 1 - t * t;
      const densidad = densidadBorde * (zona === ZONA.DENTRO ? 1.0 : 0.78);
      if (azar() > densidad) continue;

      posiciones.push({ x, z, azar: azar(), corazon: intensidad });
    }
  }

  sembrarCorazon(posiciones, nivel, corazon, lado, azar);
  return posiciones;
}

/**
 * Segunda siembra, solo dentro del corazón, con una rejilla más fina.
 *
 * La rejilla del campo tiene un paso fijo, así que subir la probabilidad de
 * aceptación dentro del corazón no puede acercar las flores entre sí: como
 * mucho llena huecos. Para que el corazón se vea como una masa compacta y no
 * como un moteado, hay que plantarlo con un paso menor.
 */
function sembrarCorazon(posiciones, nivel, corazon, ladoCampo, azar) {
  const lado = ladoCampo * 0.58;
  const alcance = corazon.escala * 1.45;

  const desdeX = corazon.centroX - alcance;
  const hastaX = corazon.centroX + alcance;
  const desdeZ = corazon.centroZ - alcance;
  const hastaZ = corazon.centroZ + alcance;

  const pasosX = Math.ceil((hastaX - desdeX) / lado);
  const pasosZ = Math.ceil((hastaZ - desdeZ) / lado);

  for (let i = 0; i < pasosX; i++) {
    for (let j = 0; j < pasosZ; j++) {
      const x = desdeX + (i + 0.5) * lado + (azar() - 0.5) * lado * 1.5;
      const z = desdeZ + (j + 0.5) * lado + (azar() - 0.5) * lado * 1.5;

      const { zona, intensidad } = zonaCorazon(x, z, corazon);
      if (zona !== ZONA.DENTRO) continue;
      if (azar() > 0.82) continue;

      posiciones.push({ x, z, azar: azar(), corazon: intensidad });
    }
  }
}

/**
 * Construye el campo completo como una única InstancedMesh.
 *
 * Todos los girasoles comparten geometría y material; lo que los diferencia
 * son la matriz de instancia (posición, giro, escala) y tres atributos
 * instanciados: fase de viento, tinte y pertenencia al corazón.
 */
export async function crearCampo(nivel) {
  const corazon = geometriaCorazon(nivel);
  const posiciones = calcularPosiciones(nivel, corazon);
  const total = posiciones.length;

  if (total === 0) {
    throw new Error('El generador de campo no produjo ningún girasol; revisa nivel.radioCampo y nivel.girasoles.');
  }

  const geometria = await cargarGeometriaGirasol();

  const fases = new Float32Array(total);
  const tintes = new Float32Array(total);
  const corazones = new Float32Array(total);
  const mundos = new Float32Array(total * 3);

  const auxiliar = new THREE.Object3D();
  const malla = new THREE.InstancedMesh(geometria, null, total);
  malla.name = 'campo';
  malla.frustumCulled = false;

  for (let i = 0; i < total; i++) {
    const { x, z, azar, corazon: dentro } = posiciones[i];
    const y = alturaTerreno(x, z);

    auxiliar.position.set(x, y, z);
    // Los girasoles miran al sol, que está detrás del visitante: al recorrer
    // el sendero se ven las caras, no los reversos. El giro aleatorio es
    // pequeño porque un campo real apunta casi todo al mismo lado.
    auxiliar.rotation.set(0, Math.PI + (azar - 0.5) * 0.8, 0);
    // Girasol adulto: entre 1,10 m y 1,65 m. Con la cámara a 1,55 m el
    // visitante queda DENTRO del cultivo, no mirándolo desde arriba, y el
    // anillo del corazón queda tapado por el follaje hasta la vista aérea.
    // El corazón apenas gana altura: si sobresale, se delata desde el suelo.
    const escala = 1.10 + azar * 0.55 + dentro * 0.06;
    auxiliar.scale.setScalar(escala);
    auxiliar.updateMatrix();
    malla.setMatrixAt(i, auxiliar.matrix);

    fases[i] = azar * Math.PI * 2;
    tintes[i] = azar;
    corazones[i] = dentro;
    mundos[i * 3 + 0] = x;
    mundos[i * 3 + 1] = y;
    mundos[i * 3 + 2] = z;
  }

  malla.instanceMatrix.needsUpdate = true;

  const atributoFase = new THREE.InstancedBufferAttribute(fases, 1);
  const atributoTinte = new THREE.InstancedBufferAttribute(tintes, 1);
  const atributoCorazon = new THREE.InstancedBufferAttribute(corazones, 1);
  const atributoMundo = new THREE.InstancedBufferAttribute(mundos, 3);
  geometria.setAttribute('aFase', atributoFase);
  geometria.setAttribute('aTinte', atributoTinte);
  geometria.setAttribute('aCorazon', atributoCorazon);
  geometria.setAttribute('aMundo', atributoMundo);

  const fase = instancedBufferAttribute(atributoFase);
  const tinte = instancedBufferAttribute(atributoTinte);
  const dentroCorazon = instancedBufferAttribute(atributoCorazon);
  const mundo = instancedBufferAttribute(atributoMundo);

  const material = new THREE.MeshStandardNodeMaterial({
    roughness: 0.78,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  material.positionNode = positionLocal.add(
    desplazamientoViento({ mundoXZ: mundo.xz, fase, alturaFlor: ALTURA_GIRASOL })
  );

  // Variación de tono por flor sobre el color horneado de cada parte, más
  // una saturación extra dentro del corazón.
  const tintado = mix(vec3(0.86, 0.83, 0.77), vec3(1.1, 1.05, 0.86), tinte);
  const realce = mix(vec3(0.94, 0.92, 0.9), vec3(1.28, 1.14, 0.62), dentroCorazon);
  material.colorNode = attribute('color', 'vec3').mul(tintado).mul(realce);

  malla.material = material;
  malla.computeBoundingSphere();

  return { malla, total, corazon };
}
