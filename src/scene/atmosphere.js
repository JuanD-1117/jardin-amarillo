import * as THREE from 'three/webgpu';
import { positionLocal, normalize, dot, max, pow, mix, smoothstep, uniform, vec3, float } from 'three/tsl';
import { crearRng } from '../core/random.js';

/**
 * Cielo y ciclo de luz.
 *
 * Un único parámetro, `momento`, recorre la tarde entera:
 *
 *     0.0  hora dorada, el sol alto y cálido
 *     0.5  atardecer, el sol tocando el horizonte
 *     1.0  noche, luna y estrellas
 *
 * Todo lo que cambia con la hora (colores del cielo, niebla, intensidad y
 * color de cada luz, brillo de las estrellas, altura del sol) se deriva de
 * ese único número. Así la transición no puede desincronizarse: no hay dos
 * animaciones que mantener en fase.
 */

const PALETA = {
  cenitDia: new THREE.Color(0x4f86c6),
  cenitTarde: new THREE.Color(0x9c5f3a),
  cenitNoche: new THREE.Color(0x070b1c),

  horizonteDia: new THREE.Color(0xe8c187),
  horizonteTarde: new THREE.Color(0xd4622a),
  horizonteNoche: new THREE.Color(0x121a33),

  solDia: new THREE.Color(0xffc463),
  solTarde: new THREE.Color(0xff7a2f),
  lunaNoche: new THREE.Color(0x8fa6d8)
};

/** Interpola en tres tramos: día -> tarde -> noche. */
function tresTramos(destino, dia, tarde, noche, momento) {
  if (momento <= 0.5) {
    return destino.copy(dia).lerp(tarde, momento / 0.5);
  }
  return destino.copy(tarde).lerp(noche, (momento - 0.5) / 0.5);
}

function crearEstrellas(cantidad, radio) {
  const azar = crearRng(77002);
  const posiciones = new Float32Array(cantidad * 3);
  const tamanos = new Float32Array(cantidad);

  for (let i = 0; i < cantidad; i++) {
    // Distribución uniforme sobre la semiesfera superior.
    const u = azar();
    const v = azar();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(v * 0.92 + 0.04);

    posiciones[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * radio;
    posiciones[i * 3 + 1] = Math.cos(phi) * radio;
    posiciones[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radio;
    tamanos[i] = 0.6 + azar() * azar() * 2.6;
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute('size', new THREE.BufferAttribute(tamanos, 1));
  return geometria;
}

export function crearAtmosfera(escena, nivel) {
  // --- Cúpula de cielo -----------------------------------------------------

  const cenit = uniform(new THREE.Color(PALETA.cenitDia));
  const horizonte = uniform(new THREE.Color(PALETA.horizonteDia));
  const colorSol = uniform(new THREE.Color(PALETA.solDia));
  const direccionSol = uniform(new THREE.Vector3(-0.55, 0.22, -0.8).normalize());
  const fuerzaHalo = uniform(0.85);

  const direccion = normalize(positionLocal);
  const altura = smoothstep(float(-0.05), float(0.55), direccion.y);
  const base = mix(horizonte, cenit, altura);

  // Halo alrededor del sol: un lóbulo estrecho sobre el degradado.
  const cercania = max(dot(direccion, direccionSol), float(0.0));
  const halo = pow(cercania, float(28.0)).mul(fuerzaHalo);
  const resplandor = pow(cercania, float(4.0)).mul(fuerzaHalo).mul(0.22);

  // La luna: un disco duro más un halo suave, que solo existe de noche.
  const direccionLuna = uniform(new THREE.Vector3(0.62, 0.46, 0.64).normalize());
  const brilloLuna = uniform(0.0);
  const cercaniaLuna = max(dot(direccion, direccionLuna), float(0.0));
  const disco = smoothstep(float(0.9993), float(0.9997), cercaniaLuna);
  const haloLuna = pow(cercaniaLuna, float(320.0)).mul(0.35);
  const luna = disco.add(haloLuna).mul(brilloLuna);

  const materialCielo = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false });
  materialCielo.colorNode = base
    .add(colorSol.mul(halo))
    .add(colorSol.mul(resplandor))
    .add(vec3(0.92, 0.94, 1.0).mul(luna));

  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), materialCielo);
  cupula.name = 'cielo';
  cupula.scale.setScalar(nivel.nieblaLejos * 3.2);
  cupula.frustumCulled = false;
  escena.add(cupula);

  // --- Estrellas -----------------------------------------------------------

  const opacidadEstrellas = uniform(0.0);
  const materialEstrellas = new THREE.PointsNodeMaterial({
    color: new THREE.Color(0xe8eeff),
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    fog: false
  });
  materialEstrellas.opacityNode = opacidadEstrellas;

  const estrellas = new THREE.Points(crearEstrellas(nivel.estrellas, 1), materialEstrellas);
  estrellas.name = 'estrellas';
  estrellas.scale.setScalar(nivel.nieblaLejos * 3.0);
  estrellas.frustumCulled = false;
  escena.add(estrellas);

  // --- Luces ---------------------------------------------------------------

  const sol = new THREE.DirectionalLight(PALETA.solDia, 3.4);
  const cielo = new THREE.HemisphereLight(0xcfe0ff, 0x6b4a22, 1.1);
  const relleno = new THREE.AmbientLight(0xffe9c4, 0.35);
  escena.add(sol, cielo, relleno);

  const colorAuxiliar = new THREE.Color();
  const nieblaColor = new THREE.Color();

  /**
   * Fija la hora del día.
   * @param {number} momento 0 hora dorada, 0.5 atardecer, 1 noche
   */
  function aplicarMomento(momento) {
    const t = THREE.MathUtils.clamp(momento, 0, 1);

    tresTramos(colorAuxiliar, PALETA.cenitDia, PALETA.cenitTarde, PALETA.cenitNoche, t);
    cenit.value.copy(colorAuxiliar);

    tresTramos(nieblaColor, PALETA.horizonteDia, PALETA.horizonteTarde, PALETA.horizonteNoche, t);
    horizonte.value.copy(nieblaColor);

    tresTramos(colorAuxiliar, PALETA.solDia, PALETA.solTarde, PALETA.lunaNoche, t);
    colorSol.value.copy(colorAuxiliar);
    sol.color.copy(colorAuxiliar);

    // El sol baja, cruza el horizonte y la luna ocupa su lugar más alta.
    const alturaSol = t < 0.62
      ? THREE.MathUtils.lerp(0.26, -0.03, t / 0.62)
      : THREE.MathUtils.lerp(-0.03, 0.42, (t - 0.62) / 0.38);

    direccionSol.value.set(-0.55, alturaSol, -0.8).normalize();
    sol.position.copy(direccionSol.value).multiplyScalar(60);

    // La luz directa se apaga antes que el cielo; la luna nunca la iguala.
    sol.intensity = t < 0.62
      ? THREE.MathUtils.lerp(3.4, 0.25, (t / 0.62) ** 1.6)
      : THREE.MathUtils.lerp(0.25, 0.55, (t - 0.62) / 0.38);

    cielo.intensity = THREE.MathUtils.lerp(1.1, 0.22, t);
    cielo.color.copy(nieblaColor).lerp(new THREE.Color(0x9fb4e8), t * 0.5);
    relleno.intensity = THREE.MathUtils.lerp(0.35, 0.09, t);

    fuerzaHalo.value = t < 0.62 ? THREE.MathUtils.lerp(0.85, 1.5, t / 0.62) : 0.12;
    opacidadEstrellas.value = THREE.MathUtils.smoothstep(t, 0.55, 0.95);
    brilloLuna.value = THREE.MathUtils.smoothstep(t, 0.6, 0.98);

    escena.fog.color.copy(nieblaColor);
    escena.background.copy(nieblaColor);
  }

  /** La cúpula acompaña a la cámara: el cielo nunca se alcanza. */
  function seguirCamara(camara) {
    cupula.position.copy(camara.position);
    estrellas.position.copy(camara.position);
  }

  aplicarMomento(0);

  return { aplicarMomento, seguirCamara, sol, cielo, relleno };
}
