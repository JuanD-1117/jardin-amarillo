# El jardín que floreció para ti 🌻

Experiencia web 3D: un campo de girasoles procedural que se recorre desde el
navegador. Se distribuye como un enlace; quien lo recibe no instala nada.

**Enlace publicado:** https://juand-1117.github.io/jardin-amarillo/

---

## Estado: V0.1

V0.1 no busca belleza, busca **validar la cadena técnica completa** antes de
invertir tiempo en contenido:

- [x] Girasol de sustitución procedural, geometría fusionada en una sola malla
- [x] Campo con `InstancedMesh` — una llamada de dibujo para todo el campo
- [x] Viento procedural en TSL (tres ondas direccionales sobre posición de mundo)
- [x] Terreno con ruido fractal; el sendero es un vacío en la distribución
- [x] `WebGPURenderer` con caída automática a WebGL 2
- [x] Tres niveles de calidad según backend y dispositivo
- [x] Build de Vite y despliegue automático a GitHub Pages

Pendiente: girasol real desde Blender (V0.2), corazón, ciclo día/noche,
mensajes personalizados, audio (V0.3–V1.0).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

Forzar un nivel de calidad sin cambiar de equipo:

```text
http://localhost:5173/?calidad=bajo
http://localhost:5173/?calidad=medio
http://localhost:5173/?calidad=alto
```

## Decisiones de arquitectura

**Todo shader custom se escribe en TSL, nunca en GLSL.** `WebGPURenderer`
solo puede caer a WebGL 2 si el grafo de nodos es portable. Un
`ShaderMaterial` con GLSL crudo rompería el backend WebGPU y con él toda la
compatibilidad.

**Blender genera una flor, no el campo.** El modelo base se exporta a
glTF + Draco; la distribución, la variación y el viento viven en Three.js.
Exportar el campo entero desde Blender produciría cientos de MB, imposible
bajo el límite de 1 GB de GitHub Pages.

**La animación de viento no se hornea.** Una animación exportada daría una
sola curva para todas las flores. El desplazamiento por vértice en el shader
permite que cada región del campo tenga una fase distinta.

**El terreno tiene una única fuente de verdad.** `alturaTerreno(x, z)` en
[`src/scene/terrain.js`](src/scene/terrain.js) la usan tanto la malla del
suelo como la colocación de cada girasol. Si divergen, las flores flotan.

**La generación es determinista.** Semilla fija en
[`src/scene/field.js`](src/scene/field.js): dos ejecuciones producen el mismo
campo, lo que permite comparar versiones del generador.

## Privacidad

GitHub Pages es público. `public/robots.txt` y la etiqueta `noindex` de
`index.html` evitan la indexación en buscadores, pero **no** ocultan el
contenido a quien tenga el enlace. Los datos personales de `data/person.json`
se incrustan en el bundle: no escribas ahí nada que no pueda ser público.

## Estructura

```text
src/
├── main.js            arranque, renderer, cámara, bucle
├── core/
│   ├── quality.js     tres presupuestos según backend y dispositivo
│   └── random.js      RNG determinista y ruido de valor/fractal
├── scene/
│   ├── terrain.js     altura del terreno y trazado del sendero
│   ├── sunflower.js   geometría del girasol (sustitución en V0.1)
│   ├── field.js       distribución e instanciación del campo
│   ├── wind.js        campo de viento en TSL
│   └── lighting.js    hora dorada
└── ui/
    ├── intro.js       pantalla de entrada y gesto de usuario para el audio
    └── styles.css

blender/               scripts de generación (V0.2, no se publican)
data/person.json       textos personalizados
```
