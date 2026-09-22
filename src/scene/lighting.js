import * as THREE from 'three/webgpu';

/**
 * Iluminación de hora dorada.
 *
 * Tres fuentes y ninguna sombra en V0.1: las sombras de 14.000 instancias
 * cuestan más de lo que aportan mientras la geometría sea de sustitución.
 * Se reevalúan en V0.2 con el modelo real.
 */
export function crearIluminacion(escena) {
  const sol = new THREE.DirectionalLight(0xffc978, 3.2);
  sol.position.set(-24, 9, 34);
  escena.add(sol);

  // Rebote frío del cielo contra rebote cálido de la tierra.
  const cielo = new THREE.HemisphereLight(0xcfe0ff, 0x6b4a22, 1.1);
  escena.add(cielo);

  // Relleno mínimo para que las caras a contraluz no queden en negro puro.
  const relleno = new THREE.AmbientLight(0xffe9c4, 0.35);
  escena.add(relleno);

  return { sol, cielo, relleno };
}
