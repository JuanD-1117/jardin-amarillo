import * as THREE from 'three/webgpu';

/**
 * Control en primera persona.
 *
 * Mirar y avanzar están separados a propósito:
 *  - mirar es arrastrar, en ratón y en táctil por igual;
 *  - avanzar es mantener pulsado (W, flecha arriba o el botón en pantalla).
 *
 * No se usa Pointer Lock: en una experiencia que alguien abre desde un enlace
 * sin contexto, capturar el cursor asusta y en iOS no existe.
 */

const ALTURA_OJOS = 1.55;
const VELOCIDAD = 3.4;          // m/s, paso tranquilo
const SENSIBILIDAD = 0.0026;    // rad por píxel
const LIMITE_VERTICAL = Math.PI * 0.38;

export function crearMovimiento({ lienzo, boton, alturaSuelo, radioLimite }) {
  let yaw = 0;
  let pitch = -0.04;
  let avanzando = false;
  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let activo = false;

  const teclas = new Set();
  const direccion = new THREE.Vector3();

  function alPulsar(evento) {
    if (!activo) return;
    arrastrando = true;
    ultimoX = evento.clientX;
    ultimoY = evento.clientY;
    lienzo.setPointerCapture(evento.pointerId);
  }

  function alMover(evento) {
    if (!arrastrando || !activo) return;
    yaw -= (evento.clientX - ultimoX) * SENSIBILIDAD;
    pitch -= (evento.clientY - ultimoY) * SENSIBILIDAD;
    pitch = THREE.MathUtils.clamp(pitch, -LIMITE_VERTICAL, LIMITE_VERTICAL);
    ultimoX = evento.clientX;
    ultimoY = evento.clientY;
  }

  function alSoltar(evento) {
    arrastrando = false;
    if (lienzo.hasPointerCapture(evento.pointerId)) {
      lienzo.releasePointerCapture(evento.pointerId);
    }
  }

  lienzo.addEventListener('pointerdown', alPulsar);
  lienzo.addEventListener('pointermove', alMover);
  lienzo.addEventListener('pointerup', alSoltar);
  lienzo.addEventListener('pointercancel', alSoltar);

  window.addEventListener('keydown', (evento) => {
    teclas.add(evento.code);
    if (['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'Space'].includes(evento.code)) {
      evento.preventDefault();
    }
  });
  window.addEventListener('keyup', (evento) => teclas.delete(evento.code));

  boton.addEventListener('pointerdown', () => { avanzando = true; });
  boton.addEventListener('pointerup', () => { avanzando = false; });
  boton.addEventListener('pointerleave', () => { avanzando = false; });
  boton.addEventListener('pointercancel', () => { avanzando = false; });

  return {
    /** Alinea el control con la cámara antes de devolver el mando. */
    adoptar(camara) {
      const frente = new THREE.Vector3();
      camara.getWorldDirection(frente);
      yaw = Math.atan2(-frente.x, -frente.z);
      pitch = Math.asin(THREE.MathUtils.clamp(frente.y, -1, 1));
      activo = true;
    },

    soltar() {
      activo = false;
      arrastrando = false;
      avanzando = false;
    },

    get caminando() {
      return activo && (avanzando || teclas.has('KeyW') || teclas.has('ArrowUp'));
    },

    actualizar(delta, camara) {
      if (!activo) return;

      const atras = teclas.has('KeyS') || teclas.has('ArrowDown');
      const lateral = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0)
        - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0);
      const frontal = (this.caminando ? 1 : 0) - (atras ? 1 : 0);

      if (frontal !== 0 || lateral !== 0) {
        // El desplazamiento ignora el cabeceo: se camina por el suelo, no se vuela.
        direccion.set(
          -Math.sin(yaw) * frontal + Math.cos(yaw) * lateral,
          0,
          -Math.cos(yaw) * frontal - Math.sin(yaw) * lateral
        );
        if (direccion.lengthSq() > 0) {
          direccion.normalize().multiplyScalar(VELOCIDAD * delta);
          camara.position.x += direccion.x;
          camara.position.z += direccion.z;

          // El campo tiene borde: más allá no hay nada que ver.
          const distancia = Math.hypot(camara.position.x, camara.position.z);
          if (distancia > radioLimite) {
            camara.position.x *= radioLimite / distancia;
            camara.position.z *= radioLimite / distancia;
          }
        }
      }

      camara.position.y = alturaSuelo(camara.position.x, camara.position.z) + ALTURA_OJOS;

      const objetivo = new THREE.Vector3(
        camara.position.x - Math.sin(yaw) * Math.cos(pitch),
        camara.position.y + Math.sin(pitch),
        camara.position.z - Math.cos(yaw) * Math.cos(pitch)
      );
      camara.lookAt(objetivo);
    }
  };
}
