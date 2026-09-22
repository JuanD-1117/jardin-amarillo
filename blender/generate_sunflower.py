"""
Genera el girasol base y lo exporta a glTF para la experiencia web.

Uso:
    blender --background --python blender/generate_sunflower.py

Salida:
    public/models/sunflower.glb

Notas de diseño
---------------
Este script produce UNA flor, no el campo. La distribución, la variación y el
viento viven en Three.js: exportar miles de flores desde Blender daría un
archivo de cientos de MB, imposible bajo el límite de 1 GB de GitHub Pages.

La geometría se construye con `from_pydata` a partir de parametrizaciones
explícitas en lugar de con operadores de malla. Es más largo de escribir pero
es determinista, no depende del estado del contexto de Blender y cada forma
queda descrita por una fórmula legible.

Presupuesto de triángulos: ~630. Con 13.000 instancias en el nivel alto son
~8,2 M de triángulos por fotograma, que un M3 sostiene a 60 fps con un
material barato. El pétalo conserva tres columnas de vértices porque con dos
se pierde el acuencado, que es lo que hace que capte la luz.

Unidades: metros. La flor se normaliza a 1,0 m de altura total; la escala
real de cada instancia la aplica Three.js.
"""

import math
import sys
from pathlib import Path

import bpy
import mathutils

# --- Parámetros de la flor -------------------------------------------------

ALTURA_OBJETIVO = 1.0          # m, altura final tras normalizar
RADIO_TALLO_BASE = 0.016       # m
RADIO_TALLO_PUNTA = 0.009      # m
LADOS_TALLO = 7
SEGMENTOS_TALLO = 9
INCLINACION_TALLO = 0.07       # m de desviación en la punta

RADIO_DISCO = 0.085            # m
ANILLOS_DISCO = 3
LADOS_DISCO = 18
DOMO_DISCO = 0.022             # m de convexidad

PETALOS_EXTERIORES = 13
PETALOS_INTERIORES = 8
LARGO_PETALO = 0.155           # m
ANCHO_PETALO = 0.052           # m
SEGMENTOS_LARGO_PETALO = 4
SEGMENTOS_ANCHO_PETALO = 1
CURVA_PETALO = 0.055           # comba a lo largo
CUENCO_PETALO = 0.028          # comba a lo ancho

ELEVACION_CABEZA = 0.22        # rad sobre la horizontal; el sol está bajo

# La cabeza se construye plana en XY. Media vuelta en X la deja mirando al
# frente del modelo (+Z en glTF) en vez de al cielo; lo que se le resta es la
# elevación con la que apunta al sol bajo.
GIRO_CABEZA = math.pi - ELEVACION_CABEZA

LARGO_HOJA = 0.21              # m
ANCHO_HOJA = 0.12              # m
SEGMENTOS_LARGO_HOJA = 5
SEGMENTOS_ANCHO_HOJA = 2


# --- Utilidades ------------------------------------------------------------


def limpiar_escena():
    """Deja la escena vacía. El script debe poder ejecutarse dos veces."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def crear_objeto(nombre, vertices, caras):
    """Crea un objeto de malla a partir de listas de vértices y caras."""
    malla = bpy.data.meshes.new(nombre)
    malla.from_pydata(vertices, [], caras)
    malla.validate(verbose=False)
    malla.update()

    objeto = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(objeto)
    return objeto


def caras_de_rejilla(columnas, filas):
    """Índices de las caras de una rejilla de (columnas x filas) vértices."""
    caras = []
    for f in range(filas - 1):
        for c in range(columnas - 1):
            a = f * columnas + c
            b = a + 1
            d = a + columnas
            e = d + 1
            caras.append((a, b, e, d))
    return caras


# --- Tallo -----------------------------------------------------------------


def curva_tallo(t):
    """
    Posición del eje del tallo para t en [0, 1].

    El tallo no es recto: se inclina progresivamente porque carga con la
    cabeza. La desviación crece con t^2, como una viga en voladizo.
    """
    x = INCLINACION_TALLO * t * t
    y = t
    z = INCLINACION_TALLO * 0.35 * t * t
    return mathutils.Vector((x, y, z))


def crear_tallo():
    vertices = []
    caras = []

    for s in range(SEGMENTOS_TALLO + 1):
        t = s / SEGMENTOS_TALLO
        centro = curva_tallo(t)

        # Marco local perpendicular a la tangente para que el tubo no se pliegue.
        adelante = (curva_tallo(min(1.0, t + 0.01)) - curva_tallo(max(0.0, t - 0.01))).normalized()
        derecha = adelante.cross(mathutils.Vector((0.0, 0.0, 1.0)))
        if derecha.length < 1e-6:
            derecha = mathutils.Vector((1.0, 0.0, 0.0))
        derecha.normalize()
        arriba = derecha.cross(adelante).normalized()

        radio = RADIO_TALLO_BASE + (RADIO_TALLO_PUNTA - RADIO_TALLO_BASE) * t

        for l in range(LADOS_TALLO):
            angulo = (l / LADOS_TALLO) * math.tau
            # Los tallos de girasol son acanalados, no cilindros perfectos.
            acanalado = 1.0 + 0.09 * math.cos(angulo * 5.0)
            desplazamiento = (derecha * math.cos(angulo) + arriba * math.sin(angulo)) * radio * acanalado
            vertices.append(tuple(centro + desplazamiento))

    for s in range(SEGMENTOS_TALLO):
        for l in range(LADOS_TALLO):
            a = s * LADOS_TALLO + l
            b = s * LADOS_TALLO + (l + 1) % LADOS_TALLO
            c = (s + 1) * LADOS_TALLO + (l + 1) % LADOS_TALLO
            d = (s + 1) * LADOS_TALLO + l
            caras.append((a, b, c, d))

    return crear_objeto('tallo', vertices, caras)


# --- Hoja ------------------------------------------------------------------


def crear_hoja(nombre, altura, giro, caida):
    """
    Hoja acorazonada que nace del tallo, se arquea y cae por su propio peso.

    `altura` es la fracción del tallo donde se inserta, `giro` el ángulo
    alrededor del tallo y `caida` cuánto se vence la punta.
    """
    vertices = []
    columnas = SEGMENTOS_ANCHO_HOJA * 2 + 1

    for f in range(SEGMENTOS_LARGO_HOJA + 1):
        u = f / SEGMENTOS_LARGO_HOJA

        # Perfil acorazonado: ancho máximo cerca del primer tercio.
        ancho = ANCHO_HOJA * math.sin(math.pi * (u ** 0.55)) * (1.0 - 0.25 * u)

        for c in range(columnas):
            v = (c / (columnas - 1)) * 2.0 - 1.0

            x = u * LARGO_HOJA
            y = v * ancho * 0.5
            # La nervadura central se mantiene alta y los bordes caen: canal en V.
            canal = (v * v) * ancho * 0.30
            arco = -caida * (u ** 2.0)
            z = arco + canal

            vertices.append((x, y, z))

    caras = caras_de_rejilla(columnas, SEGMENTOS_LARGO_HOJA + 1)
    objeto = crear_objeto(nombre, vertices, caras)

    objeto.rotation_euler = (0.0, 0.0, 0.0)
    matriz = (
        mathutils.Matrix.Translation((0.0, altura, 0.0))
        @ mathutils.Matrix.Rotation(giro, 4, 'Y')
        @ mathutils.Matrix.Rotation(-math.pi / 2, 4, 'Z')
    )
    objeto.data.transform(matriz)
    return objeto


# --- Cabeza: disco y pétalos ----------------------------------------------


def crear_disco():
    """Disco central abombado, con las semillas resueltas por textura en V0.3."""
    vertices = [(0.0, 0.0, DOMO_DISCO)]
    caras = []

    for anillo in range(1, ANILLOS_DISCO + 1):
        fraccion = anillo / ANILLOS_DISCO
        radio = RADIO_DISCO * fraccion
        # Casquete esférico: alto en el centro, plano en el borde.
        z = DOMO_DISCO * (1.0 - fraccion * fraccion)
        for l in range(LADOS_DISCO):
            angulo = (l / LADOS_DISCO) * math.tau
            vertices.append((math.cos(angulo) * radio, math.sin(angulo) * radio, z))

    # Abanico central.
    for l in range(LADOS_DISCO):
        caras.append((0, 1 + l, 1 + (l + 1) % LADOS_DISCO))

    # Anillos concéntricos.
    for anillo in range(ANILLOS_DISCO - 1):
        base = 1 + anillo * LADOS_DISCO
        siguiente = base + LADOS_DISCO
        for l in range(LADOS_DISCO):
            a = base + l
            b = base + (l + 1) % LADOS_DISCO
            c = siguiente + (l + 1) % LADOS_DISCO
            d = siguiente + l
            caras.append((a, b, c, d))

    return crear_objeto('disco', vertices, caras)


def geometria_petalo(largo, ancho, curva, cuenco, desfase_giro):
    """
    Un pétalo como superficie parametrizada.

    u recorre el pétalo de la base a la punta, v lo cruza de lado a lado.
    El ancho sigue un seno sesgado: estrecho en la base, máximo al 40 % del
    largo, en punta al final. La comba a lo largo y el cuenco a lo ancho son
    lo que hace que el pétalo capte la luz en vez de verse como cartón.
    """
    vertices = []
    columnas = SEGMENTOS_ANCHO_PETALO * 2 + 1

    for f in range(SEGMENTOS_LARGO_PETALO + 1):
        u = f / SEGMENTOS_LARGO_PETALO
        perfil = math.sin(math.pi * (u ** 0.62)) * (1.0 - 0.18 * u)

        for c in range(columnas):
            v = (c / (columnas - 1)) * 2.0 - 1.0

            x = v * ancho * 0.5 * perfil
            y = RADIO_DISCO * 0.82 + u * largo
            z = -curva * (u ** 1.8) + cuenco * (v * v) * (1.0 - u * 0.55)

            # Torsión suave: ningún pétalo real es simétrico.
            giro = desfase_giro * u
            xr = x * math.cos(giro) - z * math.sin(giro)
            zr = x * math.sin(giro) + z * math.cos(giro)

            vertices.append((xr, y, zr))

    return vertices, caras_de_rejilla(columnas, SEGMENTOS_LARGO_PETALO + 1)


def crear_petalos():
    """Dos coronas de pétalos, la interior más corta y girada media posición."""
    vertices = []
    caras = []

    coronas = (
        (PETALOS_EXTERIORES, LARGO_PETALO, ANCHO_PETALO, 0.0, 1.0),
        (PETALOS_INTERIORES, LARGO_PETALO * 0.66, ANCHO_PETALO * 0.82, math.pi / PETALOS_INTERIORES, 0.78),
    )

    for indice_corona, (cantidad, largo, ancho, desfase, escala_curva) in enumerate(coronas):
        for i in range(cantidad):
            angulo = (i / cantidad) * math.tau + desfase
            # Alternar la torsión evita que la corona se vea mecánica.
            torsion = 0.16 if i % 2 == 0 else -0.11
            base_vertices, base_caras = geometria_petalo(
                largo, ancho, CURVA_PETALO * escala_curva, CUENCO_PETALO, torsion
            )

            # Los pétalos interiores se levantan hacia el centro.
            elevacion = 0.012 if indice_corona == 1 else 0.0
            rotacion = mathutils.Matrix.Rotation(angulo, 3, 'Z')

            desplazamiento = len(vertices)
            for x, y, z in base_vertices:
                girado = rotacion @ mathutils.Vector((x, y, z + elevacion))
                vertices.append(tuple(girado))
            for cara in base_caras:
                caras.append(tuple(indice + desplazamiento for indice in cara))

    return crear_objeto('petalos', vertices, caras)


def montar_cabeza(tallo_punta, tangente):
    """
    Une disco y pétalos y los orienta según la tangente del tallo.

    La cabeza se construye en el plano XY mirando a +Z, se inclina hacia
    abajo (los girasoles maduros miran al este y caen) y se alinea con el
    extremo del tallo.
    """
    disco = crear_disco()
    petalos = crear_petalos()

    # Tras `enderezar` y la conversión Y-up del exportador, este giro deja la
    # cara del disco mirando a +Z del modelo, elevada ELEVACION_CABEZA sobre
    # la horizontal. Three.js gira cada instancia media vuelta, de modo que
    # en el mundo las caras apuntan al sol, que está detrás del visitante.
    orientar = mathutils.Matrix.Rotation(GIRO_CABEZA, 4, 'X')

    # Alineación con la punta del tallo: un giro mínimo que evita el codo.
    correccion = tangente.to_track_quat('Y', 'Z').to_matrix().to_4x4()
    colocar = mathutils.Matrix.Translation(tallo_punta) @ correccion @ orientar

    for objeto in (disco, petalos):
        objeto.data.transform(colocar)

    return disco, petalos


# --- Montaje y exportación -------------------------------------------------


def normalizar_altura(objetos):
    """Escala el conjunto para que la flor mida exactamente ALTURA_OBJETIVO."""
    maximo = max(
        (objeto.matrix_world @ mathutils.Vector(esquina)).y
        for objeto in objetos
        for esquina in objeto.bound_box
    )
    if maximo <= 0:
        raise RuntimeError('La flor generada tiene altura nula; revisa curva_tallo.')

    factor = ALTURA_OBJETIVO / maximo
    escala = mathutils.Matrix.Scale(factor, 4)
    for objeto in objetos:
        objeto.data.transform(escala)
    return factor


def enderezar(objetos):
    """
    Lleva el eje de crecimiento de +Y (como se construyó) a +Z (como espera
    Blender) para que el exportador, con export_yup=True, entregue la flor
    creciendo en +Y en glTF, que es lo que Three.js espera.

    Blender es Z-up y glTF es Y-up: el exportador aplica (x, y, z) -> (x, z, -y).
    Sin esta rotación la flor se exporta tumbada a lo largo de -Z.
    """
    rotacion = mathutils.Matrix.Rotation(math.pi / 2, 4, 'X')
    for objeto in objetos:
        objeto.data.transform(rotacion)


def contar_triangulos(objetos):
    total = 0
    for objeto in objetos:
        for poligono in objeto.data.polygons:
            total += len(poligono.vertices) - 2
    return total


def exportar(ruta_salida, objetos):
    ruta_salida.parent.mkdir(parents=True, exist_ok=True)

    for objeto in objetos:
        objeto.data.shade_smooth()

    # Sin Draco a propósito: el decodificador wasm pesa más que esta malla.
    # Sin materiales: el color lo asigna Three.js por nombre de nodo, lo que
    # permite ajustar la paleta sin reexportar.
    bpy.ops.export_scene.gltf(
        filepath=str(ruta_salida),
        export_format='GLB',
        use_visible=True,
        export_apply=True,
        export_materials='NONE',
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
        export_yup=True,
    )


def main():
    limpiar_escena()

    tallo = crear_tallo()
    hoja_baja = crear_hoja('hoja_baja', 0.31, 0.7, 0.105)
    hoja_alta = crear_hoja('hoja_alta', 0.54, 3.5, 0.082)

    punta = curva_tallo(1.0)
    tangente = (curva_tallo(1.0) - curva_tallo(0.93)).normalized()
    disco, petalos = montar_cabeza(punta, tangente)

    objetos = [tallo, hoja_baja, hoja_alta, disco, petalos]
    factor = normalizar_altura(objetos)
    enderezar(objetos)
    triangulos = contar_triangulos(objetos)

    raiz = Path(__file__).resolve().parent.parent
    salida = raiz / 'public' / 'models' / 'sunflower.glb'
    exportar(salida, objetos)

    print(f'GIRASOL objetos={len(objetos)} triangulos={triangulos} '
          f'escala={factor:.4f} salida={salida}')


if __name__ == '__main__':
    main()
