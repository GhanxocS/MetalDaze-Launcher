/**
 * MetalDaze Launcher — Skins (visor 3D + historial + capas)
 * No es un panel propio: Home la instancia y la muestra/oculta como una
 * vista superpuesta más (igual que Media/Noticias), así el nav de arriba
 * nunca desaparece y no hace falta un botón de "volver".
 *
 * El visor usa skinview3d (three.js por debajo) sobre un único canvas
 * persistente — se crea una sola vez y de ahí en más solo se le pide
 * loadSkin()/loadCape() con una textura nueva, en vez de recrear el
 * contexto WebGL cada vez que se cambia de skin o se reabre la vista.
 */
const skinview3d = require('skinview3d')
import database from '../utils/database.js'
import { skin2D } from '../utils/skin.js'
import { t } from '../utils/i18n.js'

// Instancia única reusada para recortar la cara de cada thumbnail — la
// clase no guarda estado propio, así que compartirla en vez de instanciarla
// por celda es seguro.
const sharedSkin2D = new skin2D()

// Recorta el panel "de afuera" de la capa (el que se ve al mirar al jugador
// de espaldas) de la textura cruda. Mostrar el archivo entero se ve como dos
// diseños pegoteados porque el UV de Minecraft reparte la capa en varios
// paneles (izquierda/frente/derecha/afuera) sobre la misma imagen — el
// rectángulo (12,1)-(22,17) es el que usa skinview3d como cara visible (ver
// setCapeUVs en skinview3d/libs/model.js) para una textura base de 64x32.
// Escala contra el tamaño REAL de la imagen cargada en vez de asumir 64x32 a
// fuego: algunas capes (recursos HD, ciertos eventos) vienen a resolución
// más alta con la misma proporción, y recortar en píxeles crudos de 64x32
// contra esas agarraba solo una esquina del diseño real.
function cropCapeThumbnail(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.addEventListener('load', () => {
            const scaleX = img.naturalWidth / 64
            const scaleY = img.naturalHeight / 32
            const cvs = document.createElement('canvas')
            const outScale = 4
            cvs.width = 10 * outScale
            cvs.height = 16 * outScale
            const ctx = cvs.getContext('2d')
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(img, 12 * scaleX, 1 * scaleY, 10 * scaleX, 16 * scaleY, 0, 0, cvs.width, cvs.height)
            resolve(cvs.toDataURL())
        })
        img.addEventListener('error', reject)
        img.src = dataUrl
    })
}

function makeKeyActivatable(el) {
    el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            el.click()
        }
    })
}

// Cuántas entradas de historial se conservan en total (todas las cuentas
// juntas, incluidas las subidas a mano) — evita que el store crezca sin
// límite con cada re-login/refresh.
const MAX_HISTORY = 24

// Fábricas de animación de skinview3d por nombre — mapea directo a las
// clases que ya trae la librería, sin implementar ninguna a mano.
const ANIMATIONS = {
    idle: () => new skinview3d.IdleAnimation(),
    walk: () => new skinview3d.WalkingAnimation(),
    run: () => new skinview3d.RunningAnimation(),
    wave: () => new skinview3d.WaveAnimation(),
}

class Skins {
    constructor() {
        this.db = new database()
        this.viewer = null
        this.history = []
        this.capes = []
        this.activeEntryId = null
        this.activeCapeId = null
        // "pending" es lo que se está previsualizando en el visor 3D ahora
        // mismo; "active" es lo último confirmado con el botón Guardar.
        // Clickear una skin/capa en las galerías solo mueve pending — el
        // visor se actualiza al toque, pero el borde "activo" (y el estado
        // que persiste si volvés a esta pestaña) no cambia hasta guardar.
        this.pendingEntryId = null
        this.pendingCapeId = null
        this.currentAnimation = 'idle'
        this.currentCape = null
        this.listenersBound = false
        this.resizeObserver = null
        // Recorte de cada capa (ver cropCapeThumbnail), cacheado por capeId.
        // renderCapes() reconstruye toda la grilla en cada click (para mover
        // el borde "activo"/"pending"), así que sin cachear esto cada celda
        // recalculaba su textura desde cero y TODAS quedaban sin imagen por
        // un instante — no solo la que se clickeó.
        this.capeThumbCache = new Map()
    }

    // Se llama cada vez que se entra a la vista Skins.
    async show() {
        this.bindListeners()
        this.ensureViewer()
        await this.loadCurrentAccountSkin()
        await this.loadHistory()
        this.renderAccountHistory()
        this.renderUploadedSkins()
        this.renderCapes()
    }

    bindListeners() {
        if (this.listenersBound) return
        this.listenersBound = true

        // El canvas cambia de tamaño con la ventana (o al mostrar la vista
        // por primera vez, cuando clientWidth pasa de 0 a su valor real) —
        // ResizeObserver cubre ambos casos sin depender de un evento 'resize'
        // de window que no dispara al simplemente destapar un overlay.
        const card = document.querySelector('.skins-viewer-card')
        if (card && window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this.resizeViewer())
            this.resizeObserver.observe(card)
        }

        document.querySelectorAll('.skins-chip-btn[data-anim]').forEach(btn => {
            btn.addEventListener('click', () => this.setAnimation(btn.dataset.anim))
        })

        // El input de archivo es fijo en el HTML; el tile "+" que lo dispara
        // se recrea en cada renderUploadedSkins(), así que su propio click
        // listener se ata ahí (ver createAddTile()).
        const addFile = document.getElementById('skins-add-file')
        if (addFile) {
            addFile.addEventListener('change', () => {
                const file = addFile.files && addFile.files[0]
                addFile.value = ''
                if (file) this.handleSkinFile(file)
            })
        }

        // Menú contextual: un solo listener delegado para las 3 acciones,
        // más click-afuera/Escape para cerrarlo. Se abre por celda desde
        // renderUploadedSkins() (ver openContextMenu).
        const menu = document.getElementById('skins-context-menu')
        if (menu) {
            menu.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]')
                if (!btn || !this.contextMenuEntry) return
                const entry = this.contextMenuEntry
                const cell = this.contextMenuCell
                this.closeContextMenu()
                if (btn.dataset.action === 'rename') this.renameEntry(entry, cell)
                if (btn.dataset.action === 'download') this.downloadEntry(entry)
                if (btn.dataset.action === 'delete') this.deleteEntry(entry)
            })
            document.addEventListener('click', (e) => {
                if (!menu.classList.contains('is-hidden') && !menu.contains(e.target)) this.closeContextMenu()
            })
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeContextMenu()
            })
        }

        // Modal de confirmación propio — reemplaza confirm() nativo (ver
        // showConfirm). Un solo bind: cualquier caller espera la Promise.
        const confirmOverlay = document.getElementById('skins-confirm-overlay')
        const confirmAccept = document.getElementById('skins-confirm-accept')
        const confirmCancel = document.getElementById('skins-confirm-cancel')
        if (confirmOverlay && confirmAccept && confirmCancel) {
            const resolveConfirm = (result) => {
                confirmOverlay.classList.add('is-hidden')
                if (this._confirmResolve) {
                    const resolve = this._confirmResolve
                    this._confirmResolve = null
                    resolve(result)
                }
            }
            confirmAccept.addEventListener('click', () => resolveConfirm(true))
            confirmCancel.addEventListener('click', () => resolveConfirm(false))
            confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) resolveConfirm(false) })
        }

        const saveBtn = document.getElementById('skins-save-btn')
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveChanges())
    }

    // Confirma la skin/capa previsualizada como la elegida — antes de esto,
    // clickear en las galerías solo cambiaba lo que se ve en el visor.
    async saveChanges() {
        this.activeEntryId = this.pendingEntryId
        this.activeCapeId = this.pendingCapeId
        await this.persistSelection()
        this.renderAccountHistory()
        this.renderUploadedSkins()
        this.renderCapes()
        this.updateSaveButton()
    }

    // Escribe la elección confirmada en un store aparte (una fila por
    // cuenta) — sin esto, activeEntryId/activeCapeId vivían solo en memoria
    // de esta instancia, y loadCurrentAccountSkin() los pisaba con la skin
    // "de fábrica" de la cuenta cada vez que se volvía a esta pestaña (ver
    // ahí). Guardar necesita sobrevivir a salir y volver, no solo a este
    // render.
    async persistSelection() {
        const configClient = await this.db.readData('configClient')
        const uuid = configClient?.account_selected
        if (!uuid) return
        await this.db.updateData('skinSelection', {
            entryId: this.activeEntryId,
            capeId: this.activeCapeId,
        }, uuid)
    }

    updateSaveButton() {
        const btn = document.getElementById('skins-save-btn')
        if (!btn) return
        const dirty = this.pendingEntryId !== this.activeEntryId || this.pendingCapeId !== this.activeCapeId
        btn.classList.toggle('is-hidden', !dirty)
    }

    // Reemplaza window.confirm() nativo (se veía como un diálogo de Windows
    // suelto, no como parte del launcher) por un modal propio con la misma
    // estética oscura del resto de la app.
    showConfirm(message) {
        const overlay = document.getElementById('skins-confirm-overlay')
        const messageEl = document.getElementById('skins-confirm-message')
        if (!overlay || !messageEl) return Promise.resolve(window.confirm(message))
        messageEl.textContent = message
        overlay.classList.remove('is-hidden')
        return new Promise((resolve) => { this._confirmResolve = resolve })
    }

    ensureViewer() {
        if (this.viewer) return this.viewer

        const canvas = document.getElementById('skins-3d-canvas')
        const card = document.querySelector('.skins-viewer-card')
        this.viewer = new skinview3d.SkinViewer({
            canvas,
            width: card.clientWidth || 360,
            height: card.clientHeight || 420,
            zoom: 0.75,
            fov: 45,
        })
        this.viewer.autoRotate = true
        this.viewer.autoRotateSpeed = 0.6
        this.setAnimation(this.currentAnimation)
        return this.viewer
    }

    resizeViewer() {
        if (!this.viewer) return
        const card = document.querySelector('.skins-viewer-card')
        if (!card) return
        const w = card.clientWidth
        const h = card.clientHeight
        if (w > 0 && h > 0) this.viewer.setSize(w, h)
    }

    // ══════════════════════════════════════════════════════
    // ANIMACIÓN
    // ══════════════════════════════════════════════════════

    setAnimation(name) {
        if (!this.viewer) return
        const factory = ANIMATIONS[name] || ANIMATIONS.idle
        this.viewer.animation = factory()
        this.currentAnimation = name
        document.querySelectorAll('.skins-chip-btn[data-anim]').forEach(btn => {
            btn.classList.toggle('skins-chip-btn-active', btn.dataset.anim === name)
        })
    }

    // ══════════════════════════════════════════════════════
    // CAPA
    // ══════════════════════════════════════════════════════

    // capeBase64 es null para skins sin capa asociada (historial manual,
    // "Sin capa" elegido en la galería, o cuentas AZauth/Mojang que
    // minecraft-java-core no resuelve capes para ellas).
    //
    // Nota sobre Elytra: se sacó la opción que existía antes — skinview3d la
    // renderiza muestreando una región de la MISMA textura de la capa
    // (pensada para recursos custom que pintan ahí a propósito), pero una
    // capa real de Mojang (Vanilla, MC15th, etc.) no tiene arte en esa
    // zona — sale transparente/invisible siempre. El elytra real de
    // Minecraft usa su propia textura del juego, no la capa del jugador,
    // así que no hay forma de mostrarlo bien con los datos que da la cuenta.
    applyCape(capeBase64) {
        this.currentCape = capeBase64 || null
        if (!this.viewer) return
        if (this.currentCape) this.viewer.loadCape(this.currentCape, { backEquipment: 'cape' })
        else this.viewer.loadCape(null)
    }

    // ══════════════════════════════════════════════════════
    // CARGA DE SKIN (cuenta activa)
    // ══════════════════════════════════════════════════════

    async loadCurrentAccountSkin() {
        let configClient
        try {
            configClient = await this.db.readData('configClient')
        } catch (e) {
            configClient = null
        }
        if (!configClient || !configClient.account_selected) {
            this.setEmptyViewer()
            this.capes = []
            this.capeThumbCache.clear()
            this.activeEntryId = this.pendingEntryId = null
            this.activeCapeId = this.pendingCapeId = null
            this.updateSaveButton()
            return
        }

        const uuid = configClient.account_selected
        const account = await this.db.readData('accounts', uuid)
        const skinBase64 = account?.profile?.skins?.[0]?.base64
        if (!account || !skinBase64) {
            this.setEmptyViewer()
            this.capes = []
            this.capeThumbCache.clear()
            this.activeEntryId = this.pendingEntryId = null
            this.activeCapeId = this.pendingCapeId = null
            this.updateSaveButton()
            return
        }

        // Una cuenta Microsoft puede tener varias capes desbloqueadas (evento,
        // migración, etc.) — minecraft-java-core ya las trae todas en
        // profile.capes con base64 resuelto. La activa (state:'ACTIVE') es
        // la que se pone por default; el resto se puede probar en la galería.
        this.capes = account?.profile?.capes || []
        this.capeThumbCache.clear()

        // Última elección confirmada con Guardar para ESTA cuenta (ver
        // persistSelection) — si existe, pisa el default de fábrica de abajo.
        // Si la skin/capa guardada ya no existe (se borró del historial, o
        // la cuenta perdió esa capa), se cae al default sin romper nada.
        const saved = await this.db.readData('skinSelection', uuid)

        let entryId = null
        let skinSrc = skinBase64
        let skinLabel = account.name
        if (saved?.entryId != null) {
            const entry = await this.db.readData('skinHistory', saved.entryId)
            if (entry) {
                entryId = entry.ID
                skinSrc = entry.base64
                skinLabel = entry.name
            }
        }
        this.activeEntryId = this.pendingEntryId = entryId
        await this.loadSkinIntoViewer(skinSrc, skinLabel)

        let capeId = null
        let capeBase64 = null
        if (saved?.capeId === 'none') {
            capeId = 'none'
        } else if (saved?.capeId != null) {
            const found = this.capes.find((c, idx) => (c.id || idx) === saved.capeId)
            if (found) {
                capeId = saved.capeId
                capeBase64 = found.base64
            }
        }
        if (capeId == null) {
            const defaultCape = this.capes.find(c => c.state === 'ACTIVE') || this.capes[0]
            capeId = defaultCape?.id || null
            capeBase64 = defaultCape?.base64 || null
        }
        this.activeCapeId = this.pendingCapeId = capeId
        this.applyCape(capeBase64)
        this.updateSaveButton()
    }

    async loadSkinIntoViewer(skinSrc, label) {
        const viewer = this.ensureViewer()
        const emptyEl = document.getElementById('skins-viewer-empty')
        const nameEl = document.getElementById('skins-current-name')

        try {
            await viewer.loadSkin(skinSrc)
            if (emptyEl) emptyEl.classList.add('is-hidden')
        } catch (e) {
            if (emptyEl) {
                emptyEl.textContent = t('home.skins.loadError')
                emptyEl.classList.remove('is-hidden')
            }
        }
        if (nameEl) nameEl.textContent = label || ''
    }

    setEmptyViewer() {
        const emptyEl = document.getElementById('skins-viewer-empty')
        const nameEl = document.getElementById('skins-current-name')
        if (this.viewer) this.viewer.loadSkin(null)
        this.applyCape(null)
        if (emptyEl) {
            emptyEl.textContent = t('home.skins.empty')
            emptyEl.classList.remove('is-hidden')
        }
        if (nameEl) nameEl.textContent = ''
    }

    // ══════════════════════════════════════════════════════
    // GRILLAS (helper compartido por las 3 secciones)
    // ══════════════════════════════════════════════════════

    createCell({ id, label, imgPromiseOrSrc, active, pending, contain, onClick, onContextMenu }) {
        const cell = document.createElement('div')
        cell.className = 'skins-cell' + (active ? ' skins-cell-active' : '') + (pending ? ' skins-cell-pending' : '')
        cell.tabIndex = 0
        cell.setAttribute('role', 'button')
        cell.setAttribute('aria-label', label)

        const img = document.createElement('img')
        img.alt = label
        if (contain) img.classList.add('skins-cell-img-contain')
        if (typeof imgPromiseOrSrc === 'string') {
            img.src = imgPromiseOrSrc
        } else {
            imgPromiseOrSrc.then(src => { img.src = src })
        }

        const meta = document.createElement('div')
        meta.className = 'skins-cell-meta'
        meta.textContent = label

        cell.appendChild(img)
        cell.appendChild(meta)
        cell.dataset.cellId = id
        cell.addEventListener('click', onClick)
        if (onContextMenu) cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onContextMenu(e, cell) })
        makeKeyActivatable(cell)
        return cell
    }

    // ══════════════════════════════════════════════════════
    // ÚLTIMAS SKINS UTILIZADAS (auto-registradas por cuenta)
    // ══════════════════════════════════════════════════════

    async loadHistory() {
        let all = []
        try {
            all = await this.db.readAllData('skinHistory')
        } catch (e) {
            all = []
        }
        this.history = all.slice().sort((a, b) => b.capturedAt - a.capturedAt).slice(0, MAX_HISTORY)
    }

    renderAccountHistory() {
        const grid = document.getElementById('skins-history-grid')
        const empty = document.getElementById('skins-history-empty')
        if (!grid) return
        grid.innerHTML = ''

        const entries = this.history.filter(e => !e.custom)
        empty.classList.toggle('is-hidden', entries.length > 0)

        for (const entry of entries) {
            const cell = this.createCell({
                id: entry.ID,
                label: entry.name,
                imgPromiseOrSrc: sharedSkin2D.creatHeadTexture(entry.base64),
                active: entry.ID === this.activeEntryId,
                pending: entry.ID === this.pendingEntryId && this.pendingEntryId !== this.activeEntryId,
                onClick: () => this.selectHistoryEntry(entry),
            })
            grid.appendChild(cell)
        }
    }

    // Solo previsualiza — el borde "activo" no se mueve hasta Guardar (ver
    // saveChanges). No toca la capa previsualizada: skin y capa se eligen
    // por separado, cambiar de skin no debería tirar abajo una capa que el
    // usuario ya venía probando en la galería de Capas.
    selectHistoryEntry(entry) {
        this.pendingEntryId = entry.ID
        this.loadSkinIntoViewer(entry.base64, entry.name)
        this.renderAccountHistory()
        this.renderUploadedSkins()
        this.updateSaveButton()
    }

    // ══════════════════════════════════════════════════════
    // SKINS SUBIDAS A MANO (archivo local, sin cuenta asociada)
    // ══════════════════════════════════════════════════════

    renderUploadedSkins() {
        const grid = document.getElementById('skins-uploaded-grid')
        if (!grid) return
        grid.innerHTML = ''
        grid.appendChild(this.createAddTile())

        const entries = this.history.filter(e => e.custom)
        for (const entry of entries) {
            const cell = this.createCell({
                id: entry.ID,
                label: entry.name,
                imgPromiseOrSrc: sharedSkin2D.creatHeadTexture(entry.base64),
                active: entry.ID === this.activeEntryId,
                pending: entry.ID === this.pendingEntryId && this.pendingEntryId !== this.activeEntryId,
                onClick: () => this.selectHistoryEntry(entry),
                // Menú de click derecho (renombrar/descargar/eliminar) solo
                // para skins subidas a mano — no tiene sentido "eliminar" o
                // "renombrar" una entrada del historial de una cuenta real,
                // ni una capa que le pertenece a Mojang.
                onContextMenu: (e, cell) => this.openContextMenu(e, entry, cell),
            })
            grid.appendChild(cell)
        }
    }

    createAddTile() {
        const tile = document.createElement('div')
        tile.className = 'skins-add-tile'
        tile.tabIndex = 0
        tile.setAttribute('role', 'button')
        tile.setAttribute('aria-label', t('home.skins.add'))
        tile.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
        tile.addEventListener('click', () => document.getElementById('skins-add-file')?.click())
        makeKeyActivatable(tile)
        return tile
    }

    async handleSkinFile(file) {
        this.clearAddError()

        if (!/\.png$/i.test(file.name) && file.type !== 'image/png') {
            this.showAddError(t('home.skins.add.errorType'))
            return
        }

        let dataUrl
        try {
            dataUrl = await this.readFileAsDataURL(file)
        } catch (e) {
            this.showAddError(t('home.skins.add.errorRead'))
            return
        }

        let dims
        try {
            dims = await this.getImageDimensions(dataUrl)
        } catch (e) {
            this.showAddError(t('home.skins.add.errorRead'))
            return
        }

        // Las skins de Minecraft son 64x64 (formato moderno) o 64x32 (legacy,
        // sin brazo/pierna secundarios) — cualquier otra proporción no es una
        // skin válida, y skinview3d la mapearía mal sobre el modelo.
        const validSize = dims.width === 64 && (dims.height === 64 || dims.height === 32)
        if (!validSize) {
            this.showAddError(t('home.skins.add.errorSize'))
            return
        }

        const name = file.name.replace(/\.png$/i, '').trim() || 'Skin personalizada'
        const entry = await this.db.createData('skinHistory', {
            uuid: null,
            name,
            base64: dataUrl,
            capturedAt: Date.now(),
            custom: true,
        })
        await this.trimHistory()

        // Subir un archivo ya es en sí mismo el paso deliberado de
        // confirmación (elegir el archivo, pasar la validación) — a
        // diferencia de navegar la galería, se aplica directo sin pedir
        // Guardar de nuevo.
        this.activeEntryId = this.pendingEntryId = entry.ID
        await this.loadSkinIntoViewer(entry.base64, entry.name)
        await this.loadHistory()
        this.renderAccountHistory()
        this.renderUploadedSkins()
        this.updateSaveButton()
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })
    }

    getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
            img.onerror = reject
            img.src = dataUrl
        })
    }

    // Mismo criterio de tope que utils.js:recordSkinHistory — acá aparte
    // porque un alta manual (tile "+") no pasa por accountSelect().
    async trimHistory() {
        const all = await this.db.readAllData('skinHistory')
        if (all.length <= MAX_HISTORY) return
        const overflow = all.slice().sort((a, b) => a.capturedAt - b.capturedAt).slice(0, all.length - MAX_HISTORY)
        for (const entry of overflow) await this.db.deleteData('skinHistory', entry.ID)
    }

    showAddError(message) {
        const el = document.getElementById('skins-add-error')
        if (!el) return
        el.textContent = message
        el.classList.remove('is-hidden')
    }

    clearAddError() {
        const el = document.getElementById('skins-add-error')
        if (!el) return
        el.classList.add('is-hidden')
    }

    // ══════════════════════════════════════════════════════
    // MENÚ CONTEXTUAL (click derecho en una skin subida)
    // ══════════════════════════════════════════════════════

    openContextMenu(e, entry, cell) {
        const menu = document.getElementById('skins-context-menu')
        if (!menu) return
        this.contextMenuEntry = entry
        this.contextMenuCell = cell

        // Se posiciona en el cursor y después se clampea contra el borde de
        // la ventana para que no se corte si el click fue cerca del margen.
        menu.classList.remove('is-hidden')
        const menuRect = menu.getBoundingClientRect()
        const maxX = window.innerWidth - menuRect.width - 8
        const maxY = window.innerHeight - menuRect.height - 8
        menu.style.left = Math.min(e.clientX, maxX) + 'px'
        menu.style.top = Math.min(e.clientY, maxY) + 'px'
    }

    closeContextMenu() {
        const menu = document.getElementById('skins-context-menu')
        if (!menu) return
        menu.classList.add('is-hidden')
        this.contextMenuEntry = null
        this.contextMenuCell = null
    }

    // El cambio solo se guarda con un paso explícito (botón check o Enter);
    // Escape o click afuera del input cancela y no toca la skin. Antes
    // cualquier blur guardaba, lo cual era fácil de disparar sin querer.
    renameEntry(entry, cell) {
        if (!cell) return
        const meta = cell.querySelector('.skins-cell-meta')
        if (!meta) return

        const wrap = document.createElement('div')
        wrap.className = 'skins-cell-rename-wrap'

        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'skins-cell-rename-input'
        input.value = entry.name
        input.maxLength = 32

        const confirmBtn = document.createElement('button')
        confirmBtn.type = 'button'
        confirmBtn.className = 'skins-cell-rename-confirm'
        confirmBtn.setAttribute('aria-label', t('home.skins.ctx.rename'))
        confirmBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>'

        wrap.appendChild(input)
        wrap.appendChild(confirmBtn)
        meta.replaceWith(wrap)
        input.focus()
        input.select()

        let settled = false
        const commit = async () => {
            if (settled) return
            settled = true
            const newName = input.value.trim()
            if (newName && newName !== entry.name) {
                entry.name = newName
                await this.db.updateData('skinHistory', entry, entry.ID)
                await this.loadHistory()
            }
            this.renderUploadedSkins()
        }
        const cancel = () => {
            if (settled) return
            settled = true
            this.renderUploadedSkins()
        }
        confirmBtn.addEventListener('click', commit)
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); commit() }
            if (ev.key === 'Escape') { ev.preventDefault(); cancel() }
        })
        // El blur normal (click afuera sin usar el check) cancela — pero no
        // el que pasa al tocar el propio botón de confirmar (ese ya llama a
        // commit() en su click); un pequeño delay evita la carrera entre
        // ambos eventos.
        input.addEventListener('blur', () => setTimeout(cancel, 150))
    }

    downloadEntry(entry) {
        // Un <a download> dispara el flujo de descarga nativo de Chromium
        // (va a la carpeta de Descargas del usuario) sin necesitar un
        // diálogo de guardado propio ni tocar el proceso principal.
        const safeName = entry.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'skin'
        const link = document.createElement('a')
        link.href = entry.base64
        link.download = `${safeName}.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
    }

    async deleteEntry(entry) {
        const ok = await this.showConfirm(t('home.skins.ctx.confirmDelete').replace('%s', entry.name))
        if (!ok) return
        await this.db.deleteData('skinHistory', entry.ID)
        // Si era la activa (guardada) o solo la que estaba en preview sin
        // guardar, se vuelve a la skin/capa real de la cuenta en vez de
        // dejar el visor apuntando a algo que ya no existe.
        if (this.activeEntryId === entry.ID || this.pendingEntryId === entry.ID) {
            await this.loadCurrentAccountSkin()
        }
        await this.loadHistory()
        this.renderAccountHistory()
        this.renderUploadedSkins()
        this.renderCapes()
    }

    // ══════════════════════════════════════════════════════
    // CAPAS DE LA CUENTA ACTIVA
    // ══════════════════════════════════════════════════════

    renderCapes() {
        const grid = document.getElementById('skins-capes-grid')
        const empty = document.getElementById('skins-capes-empty')
        if (!grid) return
        grid.innerHTML = ''
        empty.classList.toggle('is-hidden', this.capes.length > 0)
        if (!this.capes.length) return

        // "Sin capa" es un tile más de la galería (mismo tamaño que una
        // capa real), primero en la lista — no un botón aparte abajo del
        // visor, que nadie asociaba con las capas.
        grid.appendChild(this.createNoCapeTile())

        this.capes.forEach((cape, idx) => {
            const capeId = cape.id || idx
            const label = cape.alias || `Capa ${idx + 1}`
            const cell = this.createCell({
                id: capeId,
                label,
                // Recorte del panel visible (ver cropCapeThumbnail), cacheado
                // por capeId (ver getCapeThumb) — si falla, mejor mostrar la
                // textura completa que dejar la celda vacía.
                imgPromiseOrSrc: this.getCapeThumb(cape, capeId),
                active: capeId === this.activeCapeId,
                pending: capeId === this.pendingCapeId && this.pendingCapeId !== this.activeCapeId,
                contain: true,
                onClick: () => this.selectCape(cape, idx),
            })
            grid.appendChild(cell)
        })
    }

    // Devuelve el data URL cacheado si ya se calculó una vez; si no, arranca
    // el recorte y lo guarda en cache apenas resuelve. createCell() acepta
    // tanto un string como una Promise, así que en el hit de cache el <img>
    // se llena de una sin pasar por un frame sin src (el parpadeo original).
    getCapeThumb(cape, capeId) {
        if (this.capeThumbCache.has(capeId)) return this.capeThumbCache.get(capeId)
        const promise = cropCapeThumbnail(cape.base64).catch(() => cape.base64)
        promise.then(src => this.capeThumbCache.set(capeId, src))
        return promise
    }

    createNoCapeTile() {
        const cell = document.createElement('div')
        const label = t('home.skins.equip.none')
        const active = this.activeCapeId === 'none'
        const pending = this.pendingCapeId === 'none' && this.pendingCapeId !== this.activeCapeId
        cell.className = 'skins-cell skins-cell-none' + (active ? ' skins-cell-active' : '') + (pending ? ' skins-cell-pending' : '')
        cell.tabIndex = 0
        cell.setAttribute('role', 'button')
        cell.setAttribute('aria-label', label)
        cell.dataset.cellId = 'none'
        cell.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>'
            + '<div class="skins-cell-meta">' + label + '</div>'
        cell.addEventListener('click', () => this.selectNoCape())
        makeKeyActivatable(cell)
        return cell
    }

    selectNoCape() {
        this.pendingCapeId = 'none'
        this.applyCape(null)
        this.renderCapes()
        this.updateSaveButton()
    }

    selectCape(cape, idx) {
        this.pendingCapeId = cape.id || idx
        this.applyCape(cape.base64)
        this.renderCapes()
        this.updateSaveButton()
    }
}

export default Skins
