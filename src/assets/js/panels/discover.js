/**
 * MetalDaze Launcher — Descubrir (catálogo de instancias)
 * No es un panel propio: Home la instancia y la muestra/oculta como una
 * vista superpuesta más (igual que Media/Skins), así el nav de arriba
 * nunca desaparece y no hace falta un botón de "volver".
 *
 * Muestra TODAS las instancias visibles para la cuenta (incluidas las que
 * el jugador ya tiene en Inicio), con un detalle rico (mods/lore/changelog)
 * al clickear una. Las que todavía no reclamó muestran un botón "Instalar"
 * — reclamar es un concepto puramente local (ver Home.instancesSetup()),
 * el backend no sabe nada de esto ni descarga nada por aparecer acá.
 */
import { buildModItems } from '../utils.js'
import { t } from '../utils/i18n.js'

function makeKeyActivatable(el) {
    el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            el.click()
        }
    })
}

class Discover {
    constructor() {
        this.instances = []
        this.claimedNames = new Set()
        this.onInstall = null
        this.detailInstance = null
        this.listenersBound = false
    }

    // instances: TODAS las visibles para la cuenta (Home.allVisibleInstances).
    // claimedNames: Set de nombres ya reclamados. onInstall(name): callback
    // async que Home provee para persistir la reclamación y refrescar Inicio
    // — Discover no toca la base de datos directamente.
    show(instances, claimedNames, onInstall) {
        this.instances = instances || []
        this.claimedNames = claimedNames || new Set()
        this.onInstall = onInstall
        this.bindListeners()
        this.render()
    }

    bindListeners() {
        if (this.listenersBound) return
        this.listenersBound = true

        const closeBtn = document.getElementById('instance-detail-close')
        const overlay = document.getElementById('instance-detail-overlay')
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetail())
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeDetail() })
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeDetail() })

        const installBtn = document.getElementById('instance-detail-install')
        if (installBtn) installBtn.addEventListener('click', () => this.installCurrent())
    }

    render() {
        const grid = document.getElementById('discover-grid')
        const empty = document.getElementById('discover-empty')
        if (!grid || !empty) return
        grid.innerHTML = ''
        empty.classList.toggle('is-hidden', this.instances.length > 0)

        for (const inst of this.instances) {
            const card = document.createElement('div')
            card.className = 'discover-card'
            card.tabIndex = 0
            card.setAttribute('role', 'button')
            card.setAttribute('aria-label', inst.displayName || inst.name)

            const img = document.createElement('img')
            img.className = 'discover-card-img'
            img.loading = 'lazy'
            img.alt = inst.displayName || inst.name
            // El thumbnail de la card usa el ícono de la instancia (el mismo
            // que ya se ve en el carrusel de Inicio) — independiente del
            // banner del detalle, que usa discoverBanner/background. Mismo
            // criterio de validación que el tile del carrusel: nunca confiar
            // en un valor que no sea una URL http(s) real.
            if (inst.icon && /^https?:\/\//i.test(inst.icon)) img.src = inst.icon

            const body = document.createElement('div')
            body.className = 'discover-card-body'

            const name = document.createElement('div')
            name.className = 'discover-card-name'
            name.textContent = inst.displayName || inst.name

            const desc = document.createElement('div')
            desc.className = 'discover-card-desc'
            desc.textContent = inst.description || ''

            body.appendChild(name)
            body.appendChild(desc)

            const footer = document.createElement('div')
            footer.className = 'discover-card-footer'
            if (this.claimedNames.has(inst.name)) {
                const badge = document.createElement('span')
                badge.className = 'discover-card-installed-badge'
                badge.textContent = t('home.discover.installed')
                footer.appendChild(badge)
            } else {
                const installBtn = document.createElement('button')
                installBtn.type = 'button'
                installBtn.className = 'discover-card-install'
                installBtn.textContent = t('home.discover.install')
                // stopPropagation: instalar no debe además abrir el detalle.
                installBtn.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.install(inst.name)
                })
                footer.appendChild(installBtn)
            }

            card.appendChild(img)
            card.appendChild(body)
            card.appendChild(footer)
            card.addEventListener('click', () => this.openDetail(inst))
            makeKeyActivatable(card)
            grid.appendChild(card)
        }
    }

    openDetail(instance) {
        this.detailInstance = instance
        const overlay = document.getElementById('instance-detail-overlay')
        const title = document.getElementById('instance-detail-title')
        const banner = document.getElementById('instance-detail-banner')
        if (!overlay || !title || !banner) return

        title.textContent = instance.displayName || instance.name
        // discoverBanner es independiente del icon/background que ya usa el
        // resto del launcher — si el dev todavía no lo cargó desde el
        // panel, cae al fondo de siempre en vez de quedar vacío. Mismo
        // criterio de validación que las cards y el tile del carrusel de
        // Inicio: nunca confiar en un valor que no sea una URL http(s).
        const bannerUrl = (instance.discoverBanner && /^https?:\/\//i.test(instance.discoverBanner)) ? instance.discoverBanner
            : (instance.background && /^https?:\/\//i.test(instance.background)) ? instance.background : null
        banner.style.backgroundImage = bannerUrl ? `url(${bannerUrl})` : ''

        // Mods, lore y changelog quedan todos visibles a la vez (mods fijo
        // a la izquierda, lore/changelog como acordeones a la derecha) —
        // no hay tabs que cambiar, solo rellenar los tres.
        this.renderModsTab()
        this.renderLoreTab()
        this.renderChangelogTab()

        const installBtn = document.getElementById('instance-detail-install')
        if (installBtn) installBtn.classList.toggle('is-hidden', this.claimedNames.has(instance.name))

        overlay.classList.remove('is-hidden')
    }

    closeDetail() {
        const overlay = document.getElementById('instance-detail-overlay')
        if (overlay) overlay.classList.add('is-hidden')
        this.detailInstance = null
    }

    renderModsTab() {
        const panel = document.getElementById('instance-detail-panel-mods')
        if (!panel) return
        panel.innerHTML = ''
        const mods = this.detailInstance.mods || []
        if (!mods.length) {
            const empty = document.createElement('div')
            empty.className = 'instance-detail-changelog-empty'
            empty.textContent = t('home.mods.empty')
            panel.appendChild(empty)
            return
        }
        for (const item of buildModItems(mods)) panel.appendChild(item)
    }

    renderLoreTab() {
        const panel = document.getElementById('instance-detail-panel-lore')
        if (!panel) return
        panel.innerHTML = ''
        // discoverLore es independiente de description (esa la sigue usando
        // el resumen corto del hero) — si el dev no cargó lore todavía, cae
        // a la descripción en vez de quedar vacío.
        const lore = (this.detailInstance.discoverLore || this.detailInstance.description || '').trim()
        const el = document.createElement('div')
        if (lore) {
            el.className = 'instance-detail-lore'
            el.textContent = lore
        } else {
            el.className = 'instance-detail-changelog-empty'
            el.textContent = t('home.detail.lore.empty')
        }
        panel.appendChild(el)
    }

    renderChangelogTab() {
        const panel = document.getElementById('instance-detail-panel-changelog')
        if (!panel) return
        panel.innerHTML = ''
        // discoverChangelog (curado a mano por el dev en el panel) tiene
        // prioridad; si está vacío, cae a las notas automáticas de
        // import-mrpack.js — "Revisar a mano..." es el único patrón de nota
        // puramente interna para el dev, se filtra en ese fallback.
        const curated = this.detailInstance.discoverChangelog || []
        const notes = curated.length
            ? curated
            : (this.detailInstance.notes || []).filter(function(n) { return !n.startsWith('Revisar a mano') })
        if (!notes.length) {
            const empty = document.createElement('div')
            empty.className = 'instance-detail-changelog-empty'
            empty.textContent = t('home.detail.changelog.empty')
            panel.appendChild(empty)
            return
        }
        for (const note of notes.slice().reverse()) {
            const entry = document.createElement('div')
            entry.className = 'instance-detail-changelog-entry'
            entry.textContent = note
            panel.appendChild(entry)
        }
    }

    async install(instanceName) {
        if (!this.onInstall) return
        await this.onInstall(instanceName)
        this.claimedNames.add(instanceName)
        this.render()
        if (this.detailInstance && this.detailInstance.name === instanceName) {
            const installBtn = document.getElementById('instance-detail-install')
            if (installBtn) installBtn.classList.add('is-hidden')
        }
    }

    async installCurrent() {
        if (!this.detailInstance) return
        await this.install(this.detailInstance.name)
    }
}

export default Discover
