# Reglas de Desarrollo: Minecraft Launcher (Electron / HTML / CSS)

## 1. Diseño Visual Estricto (Impeccable UI)
- PROHIBIDO usar bordes genéricos (ej. `border: 1px solid #ccc`, `#e2e8f0`, etc.).
- PROHIBIDO usar sombras de caja genéricas o suaves (`box-shadow` básicos).
- PROHIBIDO centrar todo el contenido; utiliza alineaciones asimétricas (generalmente a la izquierda).
- DEBES usar abundante espacio en blanco (paddings enormes como `padding: 4rem` o `6rem`) para separar secciones en lugar de líneas divisorias.
- DEBES usar alto contraste tipográfico: combina fuentes muy pequeñas, en mayúsculas y espaciadas (`font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;`) con encabezados masivos y pesados (`font-size: 3.5rem; font-weight: 900;`).
- Utiliza una estética oscura y moderna orientada al gaming.

## 2. Arquitectura CSS y HTML
- Cero CSS en línea (`style="..."`). Todo el diseño debe ir en archivos `.css` separados usando clases semánticas (BEM opcional pero recomendado, ej. `.launcher-sidebar`, `.btn-primary`).
- Utiliza variables CSS (`:root { --bg-dark: #0f0f0f; ... }`) para los colores y el espaciado.
- Utiliza exclusivamente CSS Flexbox y CSS Grid para la estructura. Nada de `float` o posicionamientos absolutos innecesarios.
- Todos los elementos interactivos deben tener transiciones suaves (`transition: all 0.2s ease;`) y efectos de `hover`/`active` (ej. escalar con `transform: scale(0.98)`).