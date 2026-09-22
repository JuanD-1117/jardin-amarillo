/**
 * Aleatoriedad determinista.
 *
 * Todo el jardín se genera a partir de una semilla fija: dos ejecuciones
 * producen exactamente el mismo campo. Sin esto no se puede depurar una
 * distribución ni comparar dos versiones del generador.
 */

/** Generador Mulberry32: rápido, sin estado global, periodo 2^32. */
export function crearRng(semilla) {
  let estado = semilla >>> 0;
  return function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entero 2D -> [0, 1). Determinista y sin estado. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Interpolación suave de quinto grado (Perlin fade). */
function suavizar(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Ruido de valor 2D en [-1, 1]. */
export function ruidoValor(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const v00 = hash2(xi, yi);
  const v10 = hash2(xi + 1, yi);
  const v01 = hash2(xi, yi + 1);
  const v11 = hash2(xi + 1, yi + 1);

  const u = suavizar(xf);
  const v = suavizar(yf);

  const superior = v00 + (v10 - v00) * u;
  const inferior = v01 + (v11 - v01) * u;
  return (superior + (inferior - superior) * v) * 2 - 1;
}

/** Ruido fractal: varias octavas de ruido de valor. */
export function ruidoFractal(x, y, octavas = 4, lagunaridad = 2.0, ganancia = 0.5) {
  let suma = 0;
  let amplitud = 1;
  let frecuencia = 1;
  let normalizador = 0;

  for (let i = 0; i < octavas; i++) {
    suma += ruidoValor(x * frecuencia, y * frecuencia) * amplitud;
    normalizador += amplitud;
    amplitud *= ganancia;
    frecuencia *= lagunaridad;
  }

  return suma / normalizador;
}
