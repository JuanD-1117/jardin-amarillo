/**
 * Escalado de calidad.
 *
 * Una sola escena, tres presupuestos. El objetivo es que el enlace nunca
 * responda "no funciona": si el equipo no alcanza el nivel alto, baja el
 * número de instancias y la resolución, no las partes narrativas.
 */

export const NIVELES = {
  alto: {
    nombre: 'alto',
    girasoles: 14000,
    radioCampo: 46,
    segmentosTerreno: 192,
    petalos: 16,
    pixelRatioMax: 2,
    nieblaCerca: 18,
    nieblaLejos: 95
  },
  medio: {
    nombre: 'medio',
    girasoles: 5000,
    radioCampo: 34,
    segmentosTerreno: 128,
    petalos: 12,
    pixelRatioMax: 1.5,
    nieblaCerca: 14,
    nieblaLejos: 70
  },
  bajo: {
    nombre: 'bajo',
    girasoles: 1600,
    radioCampo: 24,
    segmentosTerreno: 72,
    petalos: 9,
    pixelRatioMax: 1,
    nieblaCerca: 10,
    nieblaLejos: 48
  }
};

function esMovil() {
  if (navigator.userAgentData?.mobile !== undefined) {
    return navigator.userAgentData.mobile;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Elige el nivel a partir del backend real del renderer y del dispositivo.
 * Se llama DESPUÉS de renderer.init(), cuando ya se sabe si hubo WebGPU
 * o si se cayó a WebGL 2.
 */
export function elegirNivel(renderer) {
  const hayWebGPU = renderer.backend?.isWebGPUBackend === true;
  const movil = esMovil();
  const nucleos = navigator.hardwareConcurrency ?? 4;

  if (movil) {
    return hayWebGPU && nucleos >= 6 ? NIVELES.medio : NIVELES.bajo;
  }
  if (hayWebGPU) return NIVELES.alto;
  return nucleos >= 8 ? NIVELES.medio : NIVELES.bajo;
}

/** Permite forzar un nivel con ?calidad=bajo para probar sin otro equipo. */
export function nivelForzado() {
  const pedido = new URLSearchParams(location.search).get('calidad');
  return pedido && NIVELES[pedido] ? NIVELES[pedido] : null;
}
