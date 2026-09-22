import * as THREE from 'three/webgpu';
import { time, uniform, float, vec2, vec3, sin, dot, pow, clamp, positionGeometry } from 'three/tsl';

/**
 * Viento procedural en TSL.
 *
 * Se escribe en TSL y no en GLSL a propósito: WebGPURenderer solo puede caer
 * a WebGL 2 si el grafo de nodos es portable. Un ShaderMaterial con GLSL
 * crudo rompería el backend WebGPU y con él todo el plan de compatibilidad.
 *
 * El campo de viento es la suma de tres ondas direccionales con distinta
 * frecuencia, dirección y velocidad, evaluadas en la posición de MUNDO de
 * cada flor. Por eso las flores vecinas comparten fase y las lejanas no:
 * el viento parece recorrer el campo en lugar de mover todo a la vez.
 */

export const viento = {
  /** Amplitud máxima del doblado en metros, en la punta del tallo. */
  fuerza: uniform(0.30),
  /** Multiplicador temporal global. */
  velocidad: uniform(0.75),
  /** Dirección dominante en el plano XZ, normalizada. */
  direccion: uniform(new THREE.Vector2(1, 0.35).normalize())
};

/**
 * Devuelve el desplazamiento local (vec3) a sumar a positionLocal.
 *
 * @param {object} opciones
 * @param {import('three/tsl').Node} opciones.mundoXZ    posición XZ de la instancia
 * @param {import('three/tsl').Node} opciones.fase       desfase por flor
 * @param {number} opciones.alturaFlor                   altura del tallo en unidades locales
 */
export function desplazamientoViento({ mundoXZ, fase, alturaFlor }) {
  const t = time.mul(viento.velocidad);

  // Frecuencias espaciales bajas: una onda cruza decenas de metros.
  const onda1 = sin(dot(mundoXZ, vec2(0.105, 0.042)).sub(t).add(fase));
  const onda2 = sin(dot(mundoXZ, vec2(-0.063, 0.171)).sub(t.mul(1.7)).add(fase.mul(1.9)));
  const onda3 = sin(dot(mundoXZ, vec2(0.28, -0.22)).sub(t.mul(2.9)).add(fase.mul(3.1)));

  const racha = onda1.mul(0.55).add(onda2.mul(0.3)).add(onda3.mul(0.15));

  // Envolvente lenta: rachas que suben y bajan de intensidad.
  const envolvente = sin(t.mul(0.21).add(fase.mul(0.3))).mul(0.35).add(0.75);
  const intensidad = racha.mul(envolvente);

  // El tallo dobla como una viga empotrada: la base no se mueve, la punta sí.
  const alturaNormalizada = clamp(positionGeometry.y.div(alturaFlor), 0.0, 1.0);
  const peso = pow(alturaNormalizada, float(2.2));

  const direccion = viento.direccion;
  const perpendicular = vec2(direccion.y.negate(), direccion.x);

  const lateral = direccion.mul(intensidad).add(perpendicular.mul(onda3).mul(0.28));
  const desplazamiento = lateral.mul(viento.fuerza).mul(peso);

  // Al doblarse, la punta también baja: el tallo no se estira.
  const caida = intensidad.mul(intensidad).mul(peso).mul(-0.09);

  return vec3(desplazamiento.x, caida, desplazamiento.y);
}
