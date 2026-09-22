/**
 * Capa de texto.
 *
 * Un solo mensaje a la vez, siempre centrado, siempre sobre el jardín. El
 * texto aparece y desaparece con una transición larga: en una experiencia
 * contemplativa un texto que entra de golpe rompe el ritmo.
 */
export function crearMensajes() {
  const capa = document.getElementById('mensaje');
  const pista = document.getElementById('pista');
  let temporizador = null;

  function limpiarTemporizador() {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  return {
    /**
     * @param {string} texto
     * @param {number} [duracion] segundos visibles; sin valor, permanece.
     */
    mostrar(texto, duracion) {
      if (!texto) return;
      limpiarTemporizador();
      capa.textContent = texto;
      capa.classList.add('visible');

      if (duracion !== undefined) {
        temporizador = setTimeout(() => {
          capa.classList.remove('visible');
          temporizador = null;
        }, duracion * 1000);
      }
    },

    ocultar() {
      limpiarTemporizador();
      capa.classList.remove('visible');
    },

    /** Indicación de controles; se retira sola y no vuelve. */
    mostrarPista(texto, duracion = 7) {
      pista.textContent = texto;
      pista.classList.add('visible');
      setTimeout(() => pista.classList.remove('visible'), duracion * 1000);
    },

    ocultarPista() {
      pista.classList.remove('visible');
    }
  };
}
