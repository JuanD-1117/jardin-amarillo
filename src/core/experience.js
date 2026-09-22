import * as THREE from 'three/webgpu';
import { crearTravelling, CURVAS } from '../animation/camera.js';
import { alturaTerreno, centroSendero } from '../scene/terrain.js';
import persona from '../../data/person.json';

/**
 * La experiencia como máquina de estados.
 *
 * La experiencia alterna tramos dirigidos y tramos libres a propósito. Si
 * todo fuese libre no habría relato; si todo fuese dirigido sería un vídeo.
 *
 *   LLEGADA      travelling de entrada por el sendero
 *   PASEO        el visitante lleva el mando
 *   REVELACION   la cámara sube y aparece el corazón
 *   ANOCHECER    el sol se pone mientras la cámara se aleja
 *   FINAL        deriva lenta con el último mensaje
 */

export const ESTADO = {
  LLEGADA: 'llegada',
  PASEO: 'paseo',
  REVELACION: 'revelacion',
  ANOCHECER: 'anochecer',
  FINAL: 'final'
};

const DURACION_LLEGADA = 13;
const DURACION_REVELACION = 12;
const DURACION_ANOCHECER = 22;

/**
 * Con el nombre relleno, el primer mensaje se encabeza como una nota escrita
 * a mano: el nombre en su propia línea y el texto debajo. Con dos puntos en
 * la misma línea suena a etiqueta, no a dedicatoria.
 */
function textoLlegada() {
  if (!persona.nombre) return persona.llegada;
  const nombre = persona.nombre.charAt(0).toUpperCase() + persona.nombre.slice(1);
  return `${nombre},\n${persona.llegada}`;
}

export function crearExperiencia({ camara, escena, nivel, corazon, atmosfera, movimiento, mensajes, ambiente }) {
  let estado = ESTADO.LLEGADA;
  let travelling = null;
  let tiempoEstado = 0;
  const dichos = new Set();

  /** Cada mensaje se dice una sola vez, aunque la condición siga cumpliéndose. */
  function decirUnaVez(clave, texto, duracion) {
    if (dichos.has(clave)) return;
    dichos.add(clave);
    mensajes.mostrar(texto, duracion);
  }

  const mirada = new THREE.Vector3();

  const nieblaInicial = { cerca: nivel.nieblaCerca, lejos: nivel.nieblaLejos };
  // Desde el aire la niebla se abre, pero no del todo: tiene que seguir
  // tapando el borde exterior del campo sembrado.
  const nieblaAerea = { cerca: nivel.nieblaLejos * 0.35, lejos: nivel.nieblaLejos * 1.9 };

  const zEntrada = -nivel.radioCampo * 0.94;
  const zFinLlegada = -nivel.radioCampo * 0.5;

  function puntoSendero(z, alturaOjos = 1.55) {
    const x = centroSendero(z);
    return new THREE.Vector3(x, alturaTerreno(x, z) + alturaOjos, z);
  }

  function iniciarLlegada() {
    travelling = crearTravelling({
      desde: puntoSendero(zEntrada),
      hasta: puntoSendero(zFinLlegada),
      miraDesde: puntoSendero(zEntrada + 7, 1.35),
      miraHasta: puntoSendero(zFinLlegada + 9, 1.45),
      duracion: DURACION_LLEGADA,
      curva: CURVAS.suavizar
    });
    mensajes.mostrar(textoLlegada(), 10);
  }

  function iniciarPaseo() {
    estado = ESTADO.PASEO;
    tiempoEstado = 0;
    travelling = null;
    movimiento.adoptar(camara);
    mensajes.mostrarPista('arrastra para mirar · mantén ▲ o W para avanzar', 9);
  }

  function iniciarRevelacion() {
    estado = ESTADO.REVELACION;
    tiempoEstado = 0;
    movimiento.soltar();
    mensajes.ocultar();
    mensajes.ocultarPista();
    ambiente.enfatizar();

    const alturaVuelo = nivel.radioCampo * 1.06;
    travelling = crearTravelling({
      desde: camara.position.clone(),
      hasta: new THREE.Vector3(0, alturaVuelo, corazon.centroZ - nivel.radioCampo * 0.66),
      miraDesde: new THREE.Vector3(camara.position.x, camara.position.y - 0.2, camara.position.z + 8),
      miraHasta: new THREE.Vector3(0, 0, corazon.centroZ),
      duracion: DURACION_REVELACION,
      curva: CURVAS.suavizarSalida
    });
  }

  function iniciarAnochecer() {
    estado = ESTADO.ANOCHECER;
    tiempoEstado = 0;

    const desde = camara.position.clone();
    travelling = crearTravelling({
      desde,
      hasta: new THREE.Vector3(desde.x * 0.7, desde.y * 1.12, desde.z - nivel.radioCampo * 0.22),
      miraDesde: new THREE.Vector3(0, 0, corazon.centroZ),
      miraHasta: new THREE.Vector3(0, 1.5, corazon.centroZ),
      duracion: DURACION_ANOCHECER,
      curva: CURVAS.suavizar
    });
  }

  function aplicarNiebla(t) {
    escena.fog.near = THREE.MathUtils.lerp(nieblaInicial.cerca, nieblaAerea.cerca, t);
    escena.fog.far = THREE.MathUtils.lerp(nieblaInicial.lejos, nieblaAerea.lejos, t);
  }

  /** Cerca del corazón el paseo se interrumpe y empieza la revelación. */
  function llegoAlCorazon() {
    const dx = camara.position.x - corazon.centroX;
    const dz = camara.position.z - corazon.centroZ;
    return Math.hypot(dx, dz) < corazon.escala * 0.92;
  }

  iniciarLlegada();

  return {
    get estado() {
      return estado;
    },

    actualizar(delta) {
      tiempoEstado += delta;

      switch (estado) {
        case ESTADO.LLEGADA: {
          const paso = travelling.avanzar(delta);
          camara.position.copy(paso.posicion);
          camara.lookAt(paso.mirada);
          if (paso.terminado) iniciarPaseo();
          break;
        }

        case ESTADO.PASEO: {
          movimiento.actualizar(delta, camara);

          if (movimiento.caminando && tiempoEstado > 2) {
            decirUnaVez('sendero', persona.sendero, 7);
          }

          if (llegoAlCorazon()) iniciarRevelacion();
          break;
        }

        case ESTADO.REVELACION: {
          const paso = travelling.avanzar(delta);
          camara.position.copy(paso.posicion);
          camara.lookAt(paso.mirada);
          aplicarNiebla(paso.progreso);

          if (paso.progreso > 0.72) decirUnaVez('revelacion', persona.revelacion, 9);
          if (paso.terminado) iniciarAnochecer();
          break;
        }

        case ESTADO.ANOCHECER: {
          const paso = travelling.avanzar(delta);
          camara.position.copy(paso.posicion);
          camara.lookAt(paso.mirada);
          atmosfera.aplicarMomento(paso.progreso);

          if (paso.progreso > 0.55) decirUnaVez('noche', persona.noche, 8);
          if (paso.terminado) {
            estado = ESTADO.FINAL;
            tiempoEstado = 0;
            mensajes.mostrar(persona.final);
          }
          break;
        }

        case ESTADO.FINAL: {
          // Deriva muy lenta alrededor del corazón: la escena sigue viva.
          const angulo = tiempoEstado * 0.013;
          const radio = Math.hypot(camara.position.x, camara.position.z - corazon.centroZ);
          camara.position.x = Math.sin(angulo) * radio;
          camara.position.z = corazon.centroZ - Math.cos(angulo) * radio;
          mirada.set(0, 1.5, corazon.centroZ);
          camara.lookAt(mirada);
          break;
        }
      }
    }
  };
}
