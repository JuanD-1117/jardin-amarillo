/**
 * El corazón del campo.
 *
 * No es una textura ni un decal: es una región del plano donde la
 * distribución de girasoles cambia. Desde el suelo no se percibe nada; solo
 * al elevar la cámara aparece la forma.
 *
 * Cómo se hace legible desde el aire
 * ----------------------------------
 * Una diferencia de densidad entre dos manchas aleatorias NO dibuja una
 * silueta: el ojo no separa "denso" de "menos denso" cuando ambas zonas
 * tienen la misma textura. Lo que sí lee es un BORDE.
 *
 * Por eso el corazón se planta como se plantaría de verdad: una masa densa
 * de flores, rodeada por un anillo de tierra despejada que la recorta contra
 * el resto del campo. El amarillo saturado contra el marrón del suelo es
 * inconfundible; la densidad y la altura solo refuerzan lo que ya dice el
 * contorno.
 */

/**
 * Ancho del anillo de tierra despejada que perfila el corazón, en metros.
 *
 * Estrecho a propósito: desde 34 m de altura 1,5 m se lee perfectamente, y
 * desde el suelo queda oculto tras el follaje. Un anillo ancho delata la
 * forma antes de tiempo y arruina la revelación.
 */
const ANCHO_ANILLO = 1.5;

/**
 * Curva implícita del corazón, normalizada a radio ~1.
 *
 *     (x² + y² - 1)³ - x² y³ ≤ 0
 *
 * Negativa dentro, positiva fuera.
 */
export function campoCorazon(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

/** Escala y centro del corazón dentro del campo, en metros. */
export function geometriaCorazon(nivel) {
  return {
    centroX: 0,
    centroZ: nivel.radioCampo * 0.16,
    escala: nivel.radioCampo * 0.34
  };
}

/**
 * Distancia con signo al borde del corazón, en metros.
 *
 * La curva implícita no es una función de distancia: su valor crece mucho más
 * rápido en unas direcciones que en otras, así que un umbral fijo daría un
 * anillo de ancho irregular. Dividir por el módulo del gradiente la convierte
 * en una distancia aproximada y el anillo sale parejo.
 */
export function distanciaCorazon(x, z, corazon) {
  const hx = (x - corazon.centroX) / corazon.escala;
  // El eje +y de la curva apunta a +z del mundo: el corazón se lee derecho
  // desde la cámara aérea, que mira hacia +z.
  const hy = (z - corazon.centroZ) / corazon.escala;

  const valor = campoCorazon(hx, hy);

  const e = 1e-3;
  const gx = (campoCorazon(hx + e, hy) - campoCorazon(hx - e, hy)) / (2 * e);
  const gy = (campoCorazon(hx, hy + e) - campoCorazon(hx, hy - e)) / (2 * e);
  const modulo = Math.max(1e-6, Math.hypot(gx, gy));

  return (valor / modulo) * corazon.escala;
}

/** Zonas en las que el corazón divide el campo. */
export const ZONA = {
  FUERA: 0,
  ANILLO: 1,
  DENTRO: 2
};

/**
 * Clasifica una coordenada del mundo.
 *
 * @returns {{zona: number, intensidad: number}} `intensidad` va de 0 en el
 *          borde interior a 1 en el corazón pleno, y sirve para graduar
 *          altura y saturación sin que el contorno quede dentado.
 */
export function zonaCorazon(x, z, corazon) {
  const distancia = distanciaCorazon(x, z, corazon);

  if (distancia > ANCHO_ANILLO) return { zona: ZONA.FUERA, intensidad: 0 };
  if (distancia > 0) return { zona: ZONA.ANILLO, intensidad: 0 };

  const profundidad = Math.min(1, -distancia / 3.5);
  return { zona: ZONA.DENTRO, intensidad: profundidad };
}
