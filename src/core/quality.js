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
    girasoles: 15000,
    radioCampo: 32,
    segmentosTerreno: 192,
    pixelRatioMax: 2,
    estrellas: 2600,
    nieblaCerca: 14,
    nieblaLejos: 78
  },
  medio: {
    nombre: 'medio',
    girasoles: 8000,
    radioCampo: 24,
    segmentosTerreno: 128,
    pixelRatioMax: 1.5,
    estrellas: 1400,
    nieblaCerca: 11,
    nieblaLejos: 58
  },
  bajo: {
    nombre: 'bajo',
    girasoles: 2600,
    radioCampo: 17,
    segmentosTerreno: 72,
    pixelRatioMax: 1,
    estrellas: 700,
    nieblaCerca: 9,
    nieblaLejos: 42
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
