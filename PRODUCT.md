# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jugadores de Minecraft que son clientes de los servidores/modpacks de MetalDaze Estudio. MetalDaze corre varias instancias/modpacks distintos (proyectos propios), y el mismo jugador elige entre ellas dentro del launcher — no es la comunidad de un único servidor. Algunas instancias son privadas (whitelist).

## Product Purpose

Distribuir y facilitar el acceso a los modpacks custom de MetalDaze Estudio: descarga/actualiza/lanza Minecraft con la configuración correcta por instancia, gestiona el login (Microsoft, Mojang, o AZauth según el deployment), y sirve como panel único para noticias, cuenta y configuración del juego. Éxito = que el jugador pueda enterarse de novedades, elegir su modpack y jugar sin fricción, sin instrucciones manuales de instalación.

## Positioning

No es un launcher genérico: está hecho a medida para las necesidades de MetalDaze Estudio — modpacks propios de sus proyectos (no packs genéricos bajados de internet), instancias privadas con whitelist, noticias integradas en el propio launcher, y personalización fina tanto del launcher como del juego. La comodidad y el cuidado visual son parte deliberada de esa diferenciación, no un añadido cosmético.

## Operating Context

Aplicación de escritorio Electron (Windows/macOS/Linux), no un sitio web — usa tecnología web (HTML/CSS/JS) pero se distribuye e instala como app nativa con auto-actualización (electron-updater + GitHub Releases). Depende de un backend propio de MetalDaze (config, lista de instancias, noticias, registro de jugadores) fuera de este repositorio. El método de login (Microsoft/Xbox, Mojang, o AZauth) lo decide la configuración del backend (`config.online`), no es elegible libremente por el usuario en runtime. Incluye Discord Rich Presence.

## Capabilities and Constraints

- Selección y lanzamiento de múltiples instancias/modpacks, cada una con su propia versión de Minecraft, loader (Forge/Fabric/NeoForge/vanilla) y whitelist opcional.
- Noticias servidas por el backend (o RSS) mostradas dentro del launcher.
- Configuración de RAM, Java, resolución, comportamiento al cerrar, descargas simultáneas, tema claro/oscuro/automático, y ajustes de juego (video/controles/audio).
- Tiempo jugado por instancia trackeado localmente (no viene del backend).
- Datos de instancia disponibles hoy: nombre, whitelist, versión/loader, estado de servidor, **descripción** (`description`) e **imagen de fondo del hero** (`background`, foto de ambiente a pantalla completa) e **ícono del tile del rail** (`icon`, imagen chica cuadrada — campos separados a propósito, nunca se usa uno como respaldo del otro). Ninguno de los tres (`description`/`background`/`icon`) tiene campo propio en el panel de admin todavía — hay que editar el JSON/API directo, y las URLs de imagen deben ser el link directo al archivo (ej. `i.imgur.com/...`, `i.ibb.co/...`), no el link a la página de la galería. No hay tags/categoría todavía. El diseño debe seguir funcionando cuando un campo opcional no está presente, y adoptar campos nuevos automáticamente si el backend los agrega a futuro.

## Brand Commitments

Launcher fork de Selvania Launcher (Luuxis License v1.0) — el crédito a Luuxis/Selvania Launcher debe mantenerse siempre visible (about/README/licencia), nunca ocultarse ni removerse.

## Evidence on Hand

Los assets de marca actuales (ícono y fondos) son placeholders generados (gradiente teal→violeta) a la espera de arte real de MetalDaze Estudio — no representan la identidad visual final y están sujetos a reemplazo.

## Product Principles

- Elegir y jugar sin fricción: menos pasos entre abrir el launcher y estar jugando el modpack correcto.
- El launcher es una extensión de la marca de MetalDaze Estudio, no un launcher genérico con un logo pegado encima.
- La configuración (launcher y juego) debe sentirse completa y cuidada, no un accesorio.
- Nunca esconder ni diluir el crédito a Luuxis/Selvania Launcher.
- Diseñar para los datos que existen hoy, dejando lugar para crecer cuando el backend sume más campos.
