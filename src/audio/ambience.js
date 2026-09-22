/**
 * Ambiente sonoro.
 *
 * El viento se sintetiza en el navegador: ruido rosa filtrado por un
 * pasa-bajos cuya frecuencia y ganancia modulan dos osciladores lentos en
 * frecuencias distintas. Eso produce rachas que suben y bajan sin repetirse,
 * igual que el viento visual del shader, y no cuesta ni un byte de descarga
 * ni plantea ninguna duda de licencia.
 *
 * La música es opcional y externa: si existe `public/audio/musica.*` se
 * carga y suena en bucle bajo el viento; si no existe, la experiencia
 * funciona igual. Ver README para las implicaciones de licencia.
 */

// Una sola ruta y un solo formato: probar varios deja varios 404 en la
// consola cuando no hay música, y mp3 lo decodifica cualquier navegador.
const RUTA_MUSICA = 'audio/musica.mp3';

const VOLUMEN_VIENTO = 0.16;
const VOLUMEN_MUSICA = 0.34;

/** Ruido rosa por el método de Voss-McCartney simplificado. */
function generarRuidoRosa(contexto, segundos) {
  const muestras = contexto.sampleRate * segundos;
  const buffer = contexto.createBuffer(1, muestras, contexto.sampleRate);
  const datos = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < muestras; i++) {
    const blanco = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + blanco * 0.0555179;
    b1 = 0.99332 * b1 + blanco * 0.0750759;
    b2 = 0.969 * b2 + blanco * 0.153852;
    b3 = 0.8665 * b3 + blanco * 0.3104856;
    b4 = 0.55 * b4 + blanco * 0.5329522;
    b5 = -0.7616 * b5 - blanco * 0.016898;
    datos[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + blanco * 0.5362) * 0.11;
    b6 = blanco * 0.115926;
  }

  // Ensamble del bucle: los últimos 0,4 s se funden sobre los primeros para
  // que el punto de empalme no chasquee.
  const fundido = Math.floor(contexto.sampleRate * 0.4);
  for (let i = 0; i < fundido; i++) {
    const t = i / fundido;
    datos[i] = datos[i] * t + datos[muestras - fundido + i] * (1 - t);
  }

  return buffer;
}

async function cargarMusica(contexto, base) {
  try {
    const respuesta = await fetch(base + RUTA_MUSICA);
    if (!respuesta.ok) return null;
    return await contexto.decodeAudioData(await respuesta.arrayBuffer());
  } catch {
    // Sin música la experiencia funciona igual, solo con el viento.
    return null;
  }
}

export function crearAmbiente({ base, boton }) {
  let contexto = null;
  let maestro = null;
  let ganVientoFiltro = null;
  let ganMusica = null;
  let silenciado = false;
  let iniciado = false;

  function actualizarBoton() {
    boton.textContent = silenciado ? '🔇' : '🔊';
    boton.setAttribute('aria-label', silenciado ? 'Activar sonido' : 'Silenciar');
  }

  boton.addEventListener('click', () => {
    silenciado = !silenciado;
    actualizarBoton();
    if (!maestro) return;
    const ahora = contexto.currentTime;
    maestro.gain.cancelScheduledValues(ahora);
    maestro.gain.setTargetAtTime(silenciado ? 0 : 1, ahora, 0.3);
  });

  actualizarBoton();

  return {
    /** Debe llamarse desde un gesto del usuario, o el navegador lo bloquea. */
    async iniciar() {
      if (iniciado) return;
      iniciado = true;

      const Contexto = window.AudioContext ?? window.webkitAudioContext;
      if (!Contexto) return;

      contexto = new Contexto();
      if (contexto.state === 'suspended') await contexto.resume();

      maestro = contexto.createGain();
      maestro.gain.value = silenciado ? 0 : 1;
      maestro.connect(contexto.destination);

      // --- Viento ---------------------------------------------------------

      const fuente = contexto.createBufferSource();
      fuente.buffer = generarRuidoRosa(contexto, 6);
      fuente.loop = true;

      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 420;
      filtro.Q.value = 0.7;

      ganVientoFiltro = contexto.createGain();
      ganVientoFiltro.gain.value = VOLUMEN_VIENTO;

      // Dos osciladores en frecuencias inconmensurables: la racha nunca se
      // repite igual, como las tres ondas del viento visual.
      const rachaLenta = contexto.createOscillator();
      rachaLenta.frequency.value = 0.043;
      const profundidadLenta = contexto.createGain();
      profundidadLenta.gain.value = 260;
      rachaLenta.connect(profundidadLenta).connect(filtro.frequency);

      const rachaRapida = contexto.createOscillator();
      rachaRapida.frequency.value = 0.117;
      const profundidadRapida = contexto.createGain();
      profundidadRapida.gain.value = VOLUMEN_VIENTO * 0.55;
      rachaRapida.connect(profundidadRapida).connect(ganVientoFiltro.gain);

      fuente.connect(filtro).connect(ganVientoFiltro).connect(maestro);
      fuente.start();
      rachaLenta.start();
      rachaRapida.start();

      // --- Música opcional ------------------------------------------------

      const buffer = await cargarMusica(contexto, base);
      if (!buffer) return;

      const musica = contexto.createBufferSource();
      musica.buffer = buffer;
      musica.loop = true;

      ganMusica = contexto.createGain();
      ganMusica.gain.value = 0;
      musica.connect(ganMusica).connect(maestro);
      musica.start();

      // Entrada larga: la música no debe anunciarse, debe estar ya ahí.
      ganMusica.gain.setTargetAtTime(VOLUMEN_MUSICA, contexto.currentTime, 6);
    },

    /** Momentos altos de la narrativa: la música sube, el viento cede. */
    enfatizar() {
      if (!contexto) return;
      const ahora = contexto.currentTime;
      if (ganMusica) ganMusica.gain.setTargetAtTime(VOLUMEN_MUSICA * 1.5, ahora, 3);
      if (ganVientoFiltro) ganVientoFiltro.gain.setTargetAtTime(VOLUMEN_VIENTO * 0.6, ahora, 3);
    }
  };
}
