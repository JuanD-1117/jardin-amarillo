# El jardín que floreció para ti 🌻

Experiencia web 3D: un campo de girasoles procedural que se recorre desde el
navegador. Se distribuye como un enlace; quien lo recibe no instala nada.

**Enlace publicado:** https://juand-1117.github.io/jardin-amarillo/

---

## Qué ocurre al abrir el enlace

```text
pantalla negra -> entrar -> travelling por el sendero -> el visitante toma
el mando -> camina hasta el centro -> la cámara se eleva y aparece el
corazón -> atardece -> noche, luna y estrellas -> mensaje final
```

Tramos dirigidos y tramos libres se alternan a propósito. Si todo fuese libre
no habría relato; si todo fuese dirigido sería un vídeo.

**Controles:** arrastrar para mirar; `W` / `↑` o el botón en pantalla para
avanzar; `A` `S` `D` para el resto.

## Estado: V0.3

- [x] Girasol modelado en Blender por script, exportado a glTF (632 triángulos)
- [x] Campo con `InstancedMesh` — una llamada de dibujo para todo el campo
- [x] Viento procedural en TSL (tres ondas direccionales sobre posición de mundo)
- [x] Terreno con ruido fractal; el sendero es un vacío en la distribución
- [x] Corazón formado por las propias flores, legible solo desde el aire
- [x] Ciclo hora dorada → atardecer → noche con luna y estrellas
- [x] Control en primera persona, con ratón y con dedo
- [x] Máquina de estados narrativa con mensajes personalizables
- [x] `WebGPURenderer` con caída automática a WebGL 2
- [x] Tres niveles de calidad según backend y dispositivo
- [x] Despliegue automático a GitHub Pages

Pendiente: audio (requiere aportar los archivos), interacción con flores
concretas, y ajuste fino de los textos.

## Personalización

Los textos viven en [`data/person.json`](data/person.json) y se incrustan en
el bundle al compilar:

| Campo | Cuándo aparece |
|---|---|
| `nombre` | Encabeza el primer mensaje. Déjalo vacío para omitirlo. |
| `llegada` | Durante el travelling de entrada. |
| `sendero` | La primera vez que el visitante camina. |
| `revelacion` | Al descubrirse el corazón desde el aire. |
| `noche` | Mientras cae la noche. |
| `final` | Se queda en pantalla al terminar. |

Frases cortas. El texto se lee sobre el campo, en movimiento, y compite con
lo que está pasando en pantalla.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

Regenerar el modelo del girasol (requiere Blender 5.x en el `PATH`):

```bash
blender --background --python blender/generate_sunflower.py
```

Forzar un nivel de calidad, o abrir los ganchos de depuración:

```text
?calidad=bajo | ?calidad=medio | ?calidad=alto
?debug=1      expone window.__jardin (escena, cámara, atmósfera, irAlCorazon())
```

## Decisiones de arquitectura

**Todo shader custom se escribe en TSL, nunca en GLSL.** `WebGPURenderer`
solo puede caer a WebGL 2 si el grafo de nodos es portable. Un
`ShaderMaterial` con GLSL crudo rompería el backend WebGPU y con él toda la
compatibilidad.

**Blender genera una flor, no el campo.** El modelo base se exporta a glTF;
la distribución, la variación y el viento viven en Three.js. Exportar el
campo entero produciría cientos de MB, imposible bajo el límite de 1 GB de
GitHub Pages.

**Sin Draco.** El decodificador wasm pesa más que esta malla: el `.glb`
completo son 26 KB.

**El color no viaja en el modelo.** El `.glb` se exporta sin materiales y
[`src/scene/sunflower.js`](src/scene/sunflower.js) hornea un color de vértice
por nombre de nodo. Así todo el campo cabe en una sola geometría, y la paleta
se ajusta sin reexportar.

**La animación de viento no se hornea.** Una animación exportada daría una
sola curva para todas las flores. El desplazamiento por vértice en el shader
permite que cada región del campo tenga una fase distinta.

**El corazón se planta, no se pinta.** Una diferencia de densidad entre dos
manchas aleatorias no dibuja una silueta: el ojo no separa "denso" de "menos
denso". Lo que sí lee es un borde. Por eso el corazón es una masa compacta
rodeada por un anillo de tierra despejada de 1,5 m, estrecho para que quede
oculto tras el follaje hasta la vista aérea. Ver
[`src/scene/heart.js`](src/scene/heart.js).

**Los girasoles miran al visitante.** El sol está bajo y detrás de la entrada
del sendero; como las flores le apuntan, quien recorre el campo ve caras
iluminadas y no reversos a contraluz.

**El terreno tiene una única fuente de verdad.** `alturaTerreno(x, z)` en
[`src/scene/terrain.js`](src/scene/terrain.js) la usan tanto la malla del
suelo como la colocación de cada girasol. Si divergen, las flores flotan.

**La hora del día es un solo número.** `aplicarMomento(t)` en
[`src/scene/atmosphere.js`](src/scene/atmosphere.js) deriva de `t` los
colores del cielo, la niebla, la posición y el color del sol, el brillo de la
luna y las estrellas. No hay dos animaciones que mantener en fase.

**La generación es determinista.** Semilla fija: dos ejecuciones producen el
mismo campo, lo que permite comparar versiones del generador.

## Privacidad

GitHub Pages es público. `public/robots.txt` y la etiqueta `noindex` de
`index.html` evitan la indexación en buscadores, pero **no** ocultan el
contenido a quien tenga el enlace. Lo que escribas en `data/person.json` se
incrusta en el bundle: no pongas ahí nada que no pueda ser público.

## Estructura

```text
src/
├── main.js               arranque, renderer, bucle
├── core/
│   ├── experience.js     máquina de estados de la narrativa
│   ├── quality.js        tres presupuestos según backend y dispositivo
│   └── random.js         RNG determinista y ruido de valor/fractal
├── scene/
│   ├── terrain.js        altura del terreno y trazado del sendero
│   ├── sunflower.js      carga del .glb y horneado de color por nodo
│   ├── field.js          distribución e instanciación del campo
│   ├── heart.js          curva implícita y anillo despejado
│   ├── wind.js           campo de viento en TSL
│   └── atmosphere.js     cielo, luna, estrellas y ciclo de luz
├── animation/
│   └── camera.js         travellings
├── interaction/
│   └── movement.js       control en primera persona
└── ui/
    ├── intro.js          pantalla de entrada y gesto para el audio
    ├── messages.js       capa de texto
    └── styles.css

blender/generate_sunflower.py   genera public/models/sunflower.glb
data/person.json                textos personalizados
```
