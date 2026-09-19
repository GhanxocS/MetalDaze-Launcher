/**
 * MetalDaze Launcher — Galería de Media (capturas de pantalla)
 * No es un panel propio: Home la instancia y la muestra/oculta como una
 * vista superpuesta más (igual que Noticias), así el nav de arriba nunca
 * desaparece y no hace falta un botón de "volver".
 * Lee las capturas de pantalla (carpeta screenshots/) de cada instancia
 * directamente del disco.
 */
const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

function makeKeyActivatable(el) {
    el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            el.click()
        }
    })
}

function toFileUrl(fullPath) {
    return 'file:///' + encodeURI(fullPath.replace(/\\/g, '/'))
}

class MediaGallery {
    constructor() {
        this.screenshots = []
        this.filterInstance = 'all'
        this.sortOrder = 'newest'
        this.listenersBound = false
    }

    // Se llama cada vez que se entra a la vista Media: escanea de nuevo por
    // si aparecieron capturas nuevas desde la última vez, y engancha los
    // listeners una sola vez la primera vez que se muestra.
    async show() {
        this.bindListeners()
        await this.scan()
        this.render()
    }

    bindListeners() {
        if (this.listenersBound) return
        this.listenersBound = true

        document.getElementById('media-filter-instance').addEventListener('change', (e) => {
            this.filterInstance = e.target.value
            this.render()
        })

        document.getElementById('media-filter-sort').addEventListener('change', (e) => {
            this.sortOrder = e.target.value
            this.render()
        })

        const lightbox = document.getElementById('media-lightbox')
        document.getElementById('media-lightbox-close').addEventListener('click', () => this.closeLightbox())
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) this.closeLightbox()
        })
        document.addEventListener('keydown', (e) => {
            // getComputedStyle, no lightbox.style.display: el estado inicial
            // oculto ahora viene de la clase .is-hidden (CSS), no de un
            // style="display:none" en línea — leer el inline style directo
            // daría '' (no "none") antes de la primera apertura y este
            // listener global (document-wide) dispararía closeLightbox()
            // con cualquier Escape en toda la app, no solo con el visor abierto.
            if (e.key === 'Escape' && window.getComputedStyle(lightbox).display !== 'none') this.closeLightbox()
        })
    }

    // ══════════════════════════════════════════════════════
    // LECTURA DE DISCO
    // ══════════════════════════════════════════════════════

    async scan() {
        this.screenshots = []

        let instancesRoot
        try {
            instancesRoot = await ipcRenderer.invoke('storage-get-instances-path')
        } catch (e) {
            return
        }
        // Misma carpeta que usa settings.js (gameSettings/storage): las
        // instancias reales viven en <instancesRoot>/instances/<nombre>/
        const INSTANCES_DIR = path.join(instancesRoot, 'instances')

        let dirs = []
        try {
            dirs = fs.readdirSync(INSTANCES_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
        } catch (e) {
            dirs = []
        }

        const instanceNames = []
        for (const dir of dirs) {
            const shotsDir = path.join(INSTANCES_DIR, dir.name, 'screenshots')
            let files = []
            try {
                files = fs.readdirSync(shotsDir, { withFileTypes: true })
                    .filter(f => f.isFile() && /\.(png|jpe?g)$/i.test(f.name))
            } catch (e) {
                files = []
            }

            if (files.length === 0) continue
            instanceNames.push(dir.name)

            for (const f of files) {
                const fullPath = path.join(shotsDir, f.name)
                let mtime = 0
                try { mtime = fs.statSync(fullPath).mtimeMs } catch (e) {}
                this.screenshots.push({ instance: dir.name, fileName: f.name, fullPath, mtime })
            }
        }

        this.populateInstanceFilter(instanceNames.sort())
    }

    populateInstanceFilter(names) {
        const select = document.getElementById('media-filter-instance')
        const previousValue = select.value

        // Se re-escanea cada vez que se abre la vista: hay que vaciar antes
        // de repoblar o las instancias se duplicarían en el dropdown.
        while (select.options.length > 1) select.remove(1)

        for (const name of names) {
            const opt = document.createElement('option')
            opt.value = name
            opt.textContent = name
            select.appendChild(opt)
        }

        if (names.includes(previousValue)) {
            select.value = previousValue
        } else {
            select.value = 'all'
            this.filterInstance = 'all'
        }
    }

    // ══════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════

    render() {
        const grid = document.getElementById('media-grid')
        const empty = document.getElementById('media-empty')
        const countEl = document.getElementById('media-count')
        grid.innerHTML = ''

        let list = this.screenshots.slice()
        if (this.filterInstance !== 'all') {
            list = list.filter(s => s.instance === this.filterInstance)
        }
        list.sort((a, b) => this.sortOrder === 'newest' ? b.mtime - a.mtime : a.mtime - b.mtime)

        countEl.textContent = list.length + (list.length === 1 ? ' captura' : ' capturas')
        empty.style.display = list.length ? 'none' : 'flex'

        for (const shot of list) {
            const cell = document.createElement('div')
            cell.className = 'media-cell'
            cell.tabIndex = 0
            cell.setAttribute('role', 'button')
            cell.setAttribute('aria-label', shot.instance + ' — ' + shot.fileName)

            const img = document.createElement('img')
            img.src = toFileUrl(shot.fullPath)
            img.loading = 'lazy'
            img.alt = shot.fileName

            const meta = document.createElement('div')
            meta.className = 'media-cell-meta'
            meta.textContent = shot.instance

            cell.appendChild(img)
            cell.appendChild(meta)

            cell.addEventListener('click', () => this.openLightbox(shot))
            makeKeyActivatable(cell)

            grid.appendChild(cell)
        }
    }

    // ══════════════════════════════════════════════════════
    // VISOR
    // ══════════════════════════════════════════════════════

    openLightbox(shot) {
        const lightbox = document.getElementById('media-lightbox')
        const img = document.getElementById('media-lightbox-img')
        const meta = document.getElementById('media-lightbox-meta')

        img.src = toFileUrl(shot.fullPath)
        img.alt = shot.fileName

        const date = new Date(shot.mtime)
        meta.textContent = shot.instance + ' — ' + date.toLocaleString()

        lightbox.style.display = 'flex'
    }

    closeLightbox() {
        document.getElementById('media-lightbox').style.display = 'none'
    }
}

export default MediaGallery;
