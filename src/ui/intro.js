/**
 * Pantalla de entrada.
 *
 * Cumple dos funciones, una visible y otra técnica: da el tono antes de que
 * aparezca nada, y aporta el gesto de usuario que los navegadores exigen
 * para poder arrancar audio más adelante (V1.0).
 */
export function crearIntro({ alEntrar }) {
  const capa = document.getElementById('intro');
  const boton = document.getElementById('entrar');
  const capaIncompatible = document.getElementById('incompatible');

  boton.addEventListener('click', () => {
    boton.disabled = true;
    capa.classList.add('desvanecido');
    // Se retira del árbol al terminar la transición para que no capture toques.
    capa.addEventListener('transitionend', () => capa.classList.add('oculto'), { once: true });
    alEntrar();
  });

  return {
    /** Habilita el botón cuando la escena ya está construida y compilada. */
    listo() {
      boton.disabled = false;
      boton.textContent = 'entrar';
    },
    /** Sustituye la intro por el mensaje de incompatibilidad. */
    fallar(motivo) {
      console.error('[jardin] no se pudo iniciar el renderizador:', motivo);
      capa.classList.add('oculto');
      capaIncompatible.classList.remove('oculto');
    }
  };
}
