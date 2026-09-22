import * as THREE from 'three/webgpu';

/**
 * Travellings de cámara.
 *
 * Los tramos cinematográficos son interpolaciones entre dos parejas
 * (posición, punto de mira) con una curva de suavizado. No se usa un spline:
 * con dos extremos y una buena curva de aceleración el movimiento ya se lee
 * como intencionado, y un spline mal parametrizado produce tirones.
 */

/** Suavizado simétrico: arranca y frena despacio. */
function suavizar(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Suavizado con arranque suave y frenada muy larga, para la revelación. */
function suavizarSalida(t) {
  return 1 - Math.pow(1 - t, 4);
}

export const CURVAS = { suavizar, suavizarSalida };

export function crearTravelling({ desde, hasta, miraDesde, miraHasta, duracion, curva = suavizar }) {
  let transcurrido = 0;

  const posicion = new THREE.Vector3();
  const mirada = new THREE.Vector3();

  return {
    duracion,
    /**
     * @returns {{posicion: THREE.Vector3, mirada: THREE.Vector3, progreso: number, terminado: boolean}}
     */
    avanzar(delta) {
      transcurrido = Math.min(duracion, transcurrido + delta);
      const bruto = duracion > 0 ? transcurrido / duracion : 1;
      const t = curva(bruto);

      posicion.copy(desde).lerp(hasta, t);
      mirada.copy(miraDesde).lerp(miraHasta, t);

      return { posicion, mirada, progreso: bruto, terminado: bruto >= 1 };
    }
  };
}
