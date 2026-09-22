import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, positionLocal, mix, vec3 } from 'three/tsl';
import { crearGeometriaGirasol, ALTURA_GIRASOL } from './sunflower.js';
import { desplazamientoViento } from './wind.js';
import { alturaTerreno, centroSendero, anchoSendero } from './terrain.js';
import { crearRng } from '../core/random.js';

const SEMILLA_CAMPO = 20260921;

/**
 * Distribución del campo.
 *
 * Rejilla con jitter en lugar de posiciones puramente aleatorias: la rejilla
 * evita los huecos y los grumos del muestreo uniforme, y el jitter borra el
 * patrón regular. La densidad cae hacia el borde para que el campo no termine
 * en un círculo recortado.
 */
function calcularPosiciones(nivel) {
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

      // El sendero es un vacío en la distribución, no una textura encima.
      const desviacion = Math.abs(x - centroSendero(z));
      if (desviacion < anchoSendero(z)) continue;

      // Adelgazamiento del borde: 1 en el centro, 0 en el radio exterior.
      const t = Math.max(0, (distancia - radio * 0.72) / (radio * 0.28));
      const densidad = 1 - t * t;
      if (azar() > densidad) continue;

      posiciones.push({ x, z, azar: azar() });
    }
  }

  return posiciones;
}

/**
 * Construye el campo completo como una única InstancedMesh.
 *
 * Todos los girasoles comparten geometría y material; lo que los diferencia
 * son la matriz de instancia (posición, giro, escala) y dos atributos
 * instanciados (fase de viento y tinte).
 */
export function crearCampo(nivel) {
  const posiciones = calcularPosiciones(nivel);
  const total = posiciones.length;

  if (total === 0) {
    throw new Error('El generador de campo no produjo ningún girasol; revisa nivel.radioCampo y nivel.girasoles.');
  }

  const geometria = crearGeometriaGirasol(nivel.petalos);

  const fases = new Float32Array(total);
  const tintes = new Float32Array(total);
  const mundos = new Float32Array(total * 3);

  const auxiliar = new THREE.Object3D();
  const malla = new THREE.InstancedMesh(geometria, null, total);
  malla.name = 'campo';
  malla.frustumCulled = false;

  for (let i = 0; i < total; i++) {
    const { x, z, azar } = posiciones[i];
    const y = alturaTerreno(x, z);

    auxiliar.position.set(x, y, z);
    // Giro pequeño: los girasoles reales miran casi todos al mismo lado.
    auxiliar.rotation.set(0, (azar - 0.5) * 0.7, 0);
    const escala = 0.72 + azar * 0.63;
    auxiliar.scale.setScalar(escala);
    auxiliar.updateMatrix();
    malla.setMatrixAt(i, auxiliar.matrix);

    fases[i] = azar * Math.PI * 2;
    tintes[i] = azar;
    mundos[i * 3 + 0] = x;
    mundos[i * 3 + 1] = y;
    mundos[i * 3 + 2] = z;
  }

  malla.instanceMatrix.needsUpdate = true;

  const atributoFase = new THREE.InstancedBufferAttribute(fases, 1);
  const atributoTinte = new THREE.InstancedBufferAttribute(tintes, 1);
  const atributoMundo = new THREE.InstancedBufferAttribute(mundos, 3);
  geometria.setAttribute('aFase', atributoFase);
  geometria.setAttribute('aTinte', atributoTinte);
  geometria.setAttribute('aMundo', atributoMundo);

  const fase = instancedBufferAttribute(atributoFase);
  const tinte = instancedBufferAttribute(atributoTinte);
  const mundo = instancedBufferAttribute(atributoMundo);

  const material = new THREE.MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  material.positionNode = positionLocal.add(
    desplazamientoViento({ mundoXZ: mundo.xz, fase, alturaFlor: ALTURA_GIRASOL })
  );

  // Variación de tono por flor sobre el color de vértice de cada parte.
  const tintado = mix(vec3(0.88, 0.84, 0.78), vec3(1.08, 1.04, 0.88), tinte);
  material.colorNode = attribute('color', 'vec3').mul(tintado);

  malla.material = material;
  malla.computeBoundingSphere();

  return { malla, total };
}
