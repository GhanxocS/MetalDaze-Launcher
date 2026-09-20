/**
 * @author Luuxis / ITakerMetal
 * MetalDaze Launcher — Home Panel REWORK v3.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup, skin2D, escapeHtml, buildModItems, t } from '../utils.js'
import MediaGallery from './media.js'
import Skins from './skins.js'
import Discover from './discover.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const nodeFetch = require('node-fetch')

// Activa por teclado (Enter/Espacio) cualquier elemento no nativo usado como
// botón (divs con role="button") — sin esto quedan inalcanzables por Tab.
function makeKeyActivatable(el) {
    el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            el.click()
        }
    })
}

// Forge identifica sus builds como "<versión de MC>-<versión de forge>"
// (ej. "1.20.1-47.4.2") — minecraft-java-core busca ese string EXACTO en
// la lista de builds disponibles (ver Minecraft-Loader/loader/forge/forge.js).
// Si en el panel se cargó solo la versión de forge ("47.4.2", el formato
// que sí usa NeoForge) el build nunca matchea y el juego tira "Build X not
// found" al arrancar. Se antepone el prefijo acá para que un dato cargado
// "a la NeoForge" en una instancia Forge no rompa el lanzamiento — "latest"
// y "recommended" se dejan tal cual, forge.js los resuelve aparte.
function normalizeLoaderBuild(loader) {
    const version = loader.loader_version
    if (loader.loader_type !== 'forge' || !version || version === 'latest' || version === 'recommended') return version
    const prefix = `${loader.minecraft_version}-`
    return version.startsWith(prefix) ? version : `${prefix}${version}`
}

// Mismo criterio de luminancia perceptual que usa el panel admin (tags.js)
// para decidir el color del texto de un pill — así una etiqueta se ve igual
// de legible acá que en el editor donde se creó.
function contrastTextColor(hex) {
    const c = (hex || '#888888').replace('#', '')
    const r = parseInt(c.substring(0, 2), 16) || 0
    const g = parseInt(c.substring(2, 4), 16) || 0
    const b = parseInt(c.substring(4, 6), 16) || 0
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 ? '#0a0a0a' : '#ffffff'
}

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.instancesList = [];
        this.allVisibleInstances = [];
        this.currentInstance = null;
        this.hasUpdate = false;
        this.updateUrl = null;
        this.media = new MediaGallery();
        this.skins = new Skins();
        this.discover = new Discover();

        // Registrar jugador en backend
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        if (auth && auth.uuid && auth.name) {
            let backendUrl = (this.config.url || 'https://metaldaze-backend-production.up.railway.app')
            nodeFetch(backendUrl + '/players/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: auth.uuid, name: auth.name })
            }).catch(function(err) { console.error('[players] Error registrando jugador:', err) })
        }

        this.news()
        this.socialLinks()
        await this.instancesSetup()
        this.skinPanelLink()
        this.checkUpdate()
        this.renderAccountChip(auth)

        const settingsBtn = document.querySelector('.settings-btn')
        settingsBtn.addEventListener('click', function() {
            changePanel('settings')
        })
        makeKeyActivatable(settingsBtn)

        const accountChip = document.getElementById('account-chip')
        accountChip.addEventListener('click', function() {
            changePanel('settings')
        })
        makeKeyActivatable(accountChip)
    }

    // ══════════════════════════════════════════════════════
    // CHIP DE CUENTA
    // ══════════════════════════════════════════════════════

    renderAccountChip(auth) {
        const nameEl = document.getElementById('account-name')
        const roleEl = document.getElementById('account-role')
        if (!auth) {
            nameEl.textContent = t('home.account.none')
            roleEl.textContent = ''
            return
        }

        const providerLabels = { Xbox: 'Microsoft', AZauth: 'AZauth', Mojang: 'Mojang' }
        nameEl.textContent = auth.name || 'Jugador'
        roleEl.textContent = providerLabels[auth.meta && auth.meta.type] || ''
    }

    // ══════════════════════════════════════════════════════
    // NOTICIAS
    // ══════════════════════════════════════════════════════

    async news() {
        let news = await config.getNews(this.config)
            .then(function(res) { return res })
            .catch(function() { return false })

        // Noticia destacada (la más reciente)
        const featuredEl = document.getElementById('featured-news')

        if (news && news.length) {
            const latest = news[0]
            const date = this.getdate(latest.publish_date)
            featuredEl.innerHTML = `
                <div class="featured-news-header">
                    <img class="featured-news-icon" src="assets/images/brand/logo-mark.png">
                    <div class="featured-news-title">${escapeHtml(latest.title)}</div>
                    <div class="featured-news-date">${escapeHtml(date.day)}<br>${escapeHtml(date.month)}</div>
                </div>
                <div class="featured-news-body">${escapeHtml(latest.content).replace(/\n/g, '<br>')}</div>
                <div class="featured-news-author">Autor — <span>${escapeHtml(latest.author)}</span></div>
            `

            // Rellenar panel completo de noticias
            const newsListEl = document.getElementById('news-list-full')
            newsListEl.innerHTML = ''
            for (let n of news) {
                const d = this.getdate(n.publish_date)
                const block = document.createElement('div')
                block.classList.add('news-block')
                block.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/brand/logo-mark.png">
                        <div class="header-text"><div class="title">${escapeHtml(n.title)}</div></div>
                        <div class="date"><div>${escapeHtml(d.day)}</div><div>${escapeHtml(d.month)}</div></div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>${escapeHtml(n.content).replace(/\n/g, '<br>')}</p>
                            <p class="news-author">Autor — <span>${escapeHtml(n.author)}</span></p>
                        </div>
                    </div>`
                newsListEl.appendChild(block)
            }
        } else {
            featuredEl.innerHTML = `
                <div class="featured-news-header">
                    <img class="featured-news-icon" src="assets/images/brand/logo-mark.png">
                    <div class="featured-news-title">${news === false ? 'Sin conexión al servidor de noticias.' : 'Sin noticias por el momento.'}</div>
                </div>
                <div class="featured-news-body">Vuelve más tarde para ver las últimas noticias de MetalDaze.</div>
            `
        }

        // Selección de pestaña real: Inicio, Noticias y Media se turnan el
        // estado activo del nav — todas son vistas superpuestas dentro de
        // Home (el nav de arriba nunca desaparece), no paneles separados.
        const navHome = document.getElementById('nav-home')
        const allNewsLink = document.getElementById('all-news-link')
        const navMedia = document.getElementById('nav-media')
        const navSkins = document.getElementById('nav-skins')
        const navDiscover = document.getElementById('nav-discover')
        const allNewsPanel = document.getElementById('all-news-panel')
        const mediaOverlay = document.getElementById('media-overlay')
        const skinsOverlay = document.getElementById('skins-overlay')
        const discoverOverlay = document.getElementById('discover-overlay')
        const self = this

        function setActiveView(view) {
            allNewsPanel.style.display = view === 'news' ? 'flex' : 'none'
            mediaOverlay.style.display = view === 'media' ? 'flex' : 'none'
            skinsOverlay.style.display = view === 'skins' ? 'flex' : 'none'
            discoverOverlay.style.display = view === 'discover' ? 'flex' : 'none'
            navHome.classList.toggle('nav-item-active', view === 'home')
            allNewsLink.classList.toggle('nav-item-active', view === 'news')
            navMedia.classList.toggle('nav-item-active', view === 'media')
            navSkins.classList.toggle('nav-item-active', view === 'skins')
            navDiscover.classList.toggle('nav-item-active', view === 'discover')

            if (view === 'media') self.media.show()
            if (view === 'skins') self.skins.show()
            if (view === 'discover') {
                self.discover.show(self.allVisibleInstances, self.claimedNames, function(name) { return self.installInstance(name) })
            }
        }

        navHome.addEventListener('click', function() { setActiveView('home') })
        allNewsLink.addEventListener('click', function() { setActiveView('news') })
        navMedia.addEventListener('click', function() { setActiveView('media') })
        navSkins.addEventListener('click', function() { setActiveView('skins') })
        navDiscover.addEventListener('click', function() { setActiveView('discover') })
        makeKeyActivatable(navHome)
        makeKeyActivatable(allNewsLink)
        makeKeyActivatable(navMedia)
        makeKeyActivatable(navSkins)
        makeKeyActivatable(navDiscover)
    }

    // Reclamar una instancia (botón "Instalar" en Descubrir) — persiste
    // localmente y refresca Inicio para que aparezca de inmediato, sin
    // pedirle al backend nada nuevo (ver instancesSetup()).
    async installInstance(name) {
        await this.db.updateData('claimedInstances', { claimed: true }, name)
        await this.instancesSetup()
    }

    // ══════════════════════════════════════════════════════
    // REDES SOCIALES
    // ══════════════════════════════════════════════════════

    socialLinks() {
        document.querySelectorAll('.social-block-sidebar').forEach(function(el) {
            el.addEventListener('click', function(e) {
                shell.openExternal(e.currentTarget.dataset.url)
            })
            makeKeyActivatable(el)
        })
    }

    // ══════════════════════════════════════════════════════
    // INSTANCIAS Y BOTÓN DE PLAY
    // ══════════════════════════════════════════════════════

    async instancesSetup() {
        const self = this
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let allInstances = await config.getInstanceList(auth && auth.uuid)
        let tagsCatalog = await config.getTagsCatalog()
        this.tagsCatalogById = new Map(tagsCatalog.map(function(t) { return [t.id, t] }))

        // Filtrar por whitelist — TODO lo que la cuenta puede ver, reclamado
        // o no. Descubrir usa esta lista completa; Inicio (más abajo) solo
        // muestra el subconjunto reclamado.
        const allVisibleInstances = allInstances.filter(function(i) {
            if (!i.whitelistActive) return true
            return i.whitelist && i.whitelist.find(function(w) { return w === (auth && auth.uuid) })
        })
        this.allVisibleInstances = allVisibleInstances

        // "Reclamar" es un concepto puramente local (no existe en el
        // backend) — evita que una instancia nueva le aparezca a todo el
        // mundo de golpe en Inicio; primero pasa por Descubrir con un botón
        // "Instalar". Bootstrap de una sola vez: la primera vez que corre
        // esta versión, todo lo que la cuenta ya podía ver se marca como
        // reclamado automáticamente, para no hacerle desaparecer instancias
        // a nadie. De ahí en más, "reclamar" solo importa para instancias
        // nuevas que se agreguen después.
        if (!configClient.claims_bootstrapped) {
            for (const inst of allVisibleInstances) {
                await this.db.updateData('claimedInstances', { claimed: true }, inst.name)
            }
            configClient.claims_bootstrapped = true
            await this.db.updateData('configClient', configClient)
        }
        const claimedRows = await this.db.readAllData('claimedInstances')
        const claimedNames = new Set(claimedRows.filter(function(r) { return r.claimed }).map(function(r) { return r.ID }))
        this.claimedNames = claimedNames

        this.instancesList = allVisibleInstances.filter(function(i) { return claimedNames.has(i.name) })

        const playBtn           = document.getElementById('play-btn')
        const playBtnLabel      = document.getElementById('play-btn-label')
        const instanceRail      = document.getElementById('instance-popup')
        const instancesListEl   = document.getElementById('instances-list-popup')
        const homeBg            = document.getElementById('home-bg')
        const homeBgGrid        = document.getElementById('home-bg-grid')

        // Sin instancias disponibles
        if (this.instancesList.length === 0) {
            instanceRail.style.display = 'none'
            playBtn.classList.remove("state-update")
            playBtn.classList.add('state-no-instance')
            playBtnLabel.textContent = t('home.play.noinstance')
            homeBg.style.backgroundImage = ""
            homeBgGrid.classList.add('visible')
            return
        }

        // Resolver instancia seleccionada
        let instanceSelect = configClient.instance_select
        if (!instanceSelect || !this.instancesList.find(function(i) { return i.name === instanceSelect })) {
            let fallback = this.instancesList.find(function(i) { return !i.whitelistActive })
            if (!fallback) fallback = this.instancesList[0]
            configClient.instance_select = fallback.name
            instanceSelect = fallback.name
            await this.db.updateData('configClient', configClient)
        }

        this.currentInstance = this.instancesList.find(function(i) { return i.name === instanceSelect })

        // Construir el rail de instancias (siempre visible, estilo XMB)
        instancesListEl.innerHTML = ''
        for (let inst of this.instancesList) {
            const el = document.createElement('div')
            el.className = 'instance-elements' + (inst.name === instanceSelect ? ' active-instance' : '')
            el.id = inst.name
            el.tabIndex = 0
            el.setAttribute('role', 'button')
            el.setAttribute('aria-label', inst.displayName || inst.name)

            const tile = document.createElement('div')
            tile.className = 'instance-tile'
            // El ícono del tile usa el campo "icon" (dedicado, todavía no
            // conectado antes de esto) — nunca el "background" del hero: una
            // foto de ambiente pensada para ocupar toda la pantalla se ve mal
            // aplastada en un cuadrado chico, y son dos cosas distintas.
            const iconUrl = (inst.icon && /^https?:\/\//i.test(inst.icon)) ? inst.icon : null
            if (iconUrl) {
                tile.style.backgroundImage = 'url(' + iconUrl + ')'
            } else {
                tile.textContent = (inst.displayName || inst.name).slice(0, 2).toUpperCase()
            }

            const label = document.createElement('span')
            label.className = 'tile-label'
            label.textContent = inst.displayName || inst.name

            el.appendChild(tile)
            el.appendChild(label)
            el.addEventListener('click', async function() {
                if (inst.name === instanceSelect) return

                document.querySelectorAll('.instance-elements').forEach(function(node) {
                    node.classList.toggle('active-instance', node.id === inst.name)
                })

                instanceSelect = inst.name
                let cfg = await self.db.readData('configClient')
                cfg.instance_select = inst.name
                await self.db.updateData('configClient', cfg)

                self.currentInstance = inst
                await self.applyInstanceTheme(inst)
            })
            makeKeyActivatable(el)

            instancesListEl.appendChild(el)
        }

        await this.applyInstanceTheme(this.currentInstance)

        // Botón de play — instancesSetup() ahora puede correr más de una vez
        // por sesión (ver installInstance(), llamado desde Descubrir), así
        // que sin este guard cada llamada apilaría un listener más sobre el
        // mismo botón (mismo problema que ya se documentó para
        // forceCloseBtn, pero ese SÍ tenía guard).
        if (!playBtn._playClickBound) {
            playBtn._playClickBound = true
            playBtn.addEventListener('click', async function() {
                if (playBtn.classList.contains('state-no-instance')) return

                if (playBtn.classList.contains('state-update')) {
                    if (self.updateUrl) shell.openExternal(self.updateUrl)
                    return
                }

                await self.startGame()
            })
        }

        this.setupMoreMenu()
    }

    // ══════════════════════════════════════════════════════
    // MENÚ "MÁS OPCIONES" (junto a JUGAR)
    // ══════════════════════════════════════════════════════

    setupMoreMenu() {
        const self = this
        const btn = document.getElementById('hero-more-btn')
        const menu = document.getElementById('hero-more-menu')
        if (!btn || !menu || btn._moreMenuBound) return
        btn._moreMenuBound = true

        function closeMenu() {
            menu.classList.add('is-hidden')
            btn.setAttribute('aria-expanded', 'false')
        }
        function openMenu() {
            menu.classList.remove('is-hidden')
            btn.setAttribute('aria-expanded', 'true')
        }

        btn.addEventListener('click', function(e) {
            e.stopPropagation()
            if (menu.classList.contains('is-hidden')) openMenu()
            else closeMenu()
        })
        document.addEventListener('click', function(e) {
            if (!menu.classList.contains('is-hidden') && !menu.contains(e.target) && e.target !== btn) closeMenu()
        })
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeMenu()
        })
        makeKeyActivatable(btn)

        menu.addEventListener('click', async function(e) {
            const item = e.target.closest('[data-action]')
            if (!item) return
            closeMenu()
            const action = item.dataset.action
            if (action === 'open-folder') await self.openInstanceFolder()
            if (action === 'crash-doctor') await self.openCrashDoctor()
            if (action === 'safe-mode') await self.startGame({ safeMode: true })
            if (action === 'fast-launch') await self.startGame({ skipVerify: true })
            if (action === 'verify-files') await self.startGame({ verifyOnly: true })
            if (action === 'view-mods') self.openModsModal()
        })

        // Modal de "Ver mods incluidos" — se abre desde el menú de arriba,
        // se cierra con la X o clickeando afuera de la tarjeta.
        const modsOverlay = document.getElementById('mods-modal-overlay')
        const modsClose = document.getElementById('mods-modal-close')
        if (modsOverlay && modsClose) {
            modsClose.addEventListener('click', () => self.closeModsModal())
            modsOverlay.addEventListener('click', function(e) {
                if (e.target === modsOverlay) self.closeModsModal()
            })
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') self.closeModsModal()
            })
        }
    }

    // instance.mods ya lo cura el panel admin (nombre, fuente, si es
    // obligatorio) — hasta acá era puramente cosmético del lado del
    // backend, nunca se le mostraba al jugador.
    openModsModal() {
        if (!this.currentInstance) return
        const overlay = document.getElementById('mods-modal-overlay')
        const list = document.getElementById('mods-modal-list')
        const empty = document.getElementById('mods-modal-empty')
        if (!overlay || !list || !empty) return

        const mods = this.currentInstance.mods || []
        list.innerHTML = ''
        list.classList.toggle('is-hidden', mods.length === 0)
        empty.classList.toggle('is-hidden', mods.length > 0)

        for (const item of buildModItems(mods)) list.appendChild(item)

        overlay.classList.remove('is-hidden')
    }

    closeModsModal() {
        const overlay = document.getElementById('mods-modal-overlay')
        if (overlay) overlay.classList.add('is-hidden')
    }

    async openInstanceFolder() {
        if (!this.currentInstance) return
        const instancesRoot = await ipcRenderer.invoke('storage-get-instances-path')
        const folder = path.join(instancesRoot, 'instances', this.currentInstance.name)
        ipcRenderer.send('storage-open-folder', folder)
    }

    async openCrashDoctor() {
        if (!this.currentInstance) return
        const instancesRoot = await ipcRenderer.invoke('storage-get-instances-path')
        const crashDir = path.join(instancesRoot, 'instances', this.currentInstance.name, 'crash-reports')

        let files = []
        try {
            files = fs.readdirSync(crashDir, { withFileTypes: true })
                .filter(function(f) { return f.isFile() && f.name.toLowerCase().endsWith('.txt') })
                .map(function(f) {
                    const full = path.join(crashDir, f.name)
                    let mtime = 0
                    try { mtime = fs.statSync(full).mtimeMs } catch (e) {}
                    return { full, mtime }
                })
        } catch (e) {
            files = []
        }

        if (!files.length) {
            this.showToast(t('home.more.crashes.empty'))
            return
        }
        files.sort(function(a, b) { return b.mtime - a.mtime })
        ipcRenderer.send('storage-open-folder', files[0].full)
    }

    // "Modo seguro" real de Mojang: resetea gráficos/distancia de render y
    // desactiva resourcepacks — NO desactiva mods (ver nota larga en
    // startGame: minecraft-java-core redescarga cualquier archivo del
    // manifest que falte en disco sin importar qué se renombre a mano).
    // options.txt está en la lista "ignored" de la instancia (no lo toca
    // la verificación de archivos), así que es seguro editarlo directo acá.
    async applySafeVideoSettings(instanceName) {
        try {
            const instancesRoot = await ipcRenderer.invoke('storage-get-instances-path')
            const optionsPath = path.join(instancesRoot, 'instances', instanceName, 'options.txt')
            const existed = fs.existsSync(optionsPath)
            const original = existed ? fs.readFileSync(optionsPath, 'utf-8') : ''

            const safeOverrides = {
                fancyGraphics: 'false',
                renderDistance: '8',
                resourcePacks: '[]',
                incompatibleResourcePacks: '[]',
            }
            const lines = existed ? original.split('\n') : []
            const seen = new Set()
            const patched = lines.map(function(line) {
                const sep = line.indexOf(':')
                const key = sep === -1 ? null : line.slice(0, sep)
                if (key && Object.prototype.hasOwnProperty.call(safeOverrides, key)) {
                    seen.add(key)
                    return key + ':' + safeOverrides[key]
                }
                return line
            })
            for (const key of Object.keys(safeOverrides)) {
                if (!seen.has(key)) patched.push(key + ':' + safeOverrides[key])
            }

            fs.mkdirSync(path.dirname(optionsPath), { recursive: true })
            fs.writeFileSync(optionsPath, patched.join('\n'), 'utf-8')
            return { optionsPath, original, existed }
        } catch (e) {
            console.error('[SafeMode] No se pudo aplicar la configuración segura:', e)
            this.showToast(t('home.more.safeMode.error'), 'error')
            return null
        }
    }

    async restoreSafeVideoSettings(instanceName, backup) {
        if (!backup) return
        try {
            if (backup.existed) fs.writeFileSync(backup.optionsPath, backup.original, 'utf-8')
            else fs.rmSync(backup.optionsPath, { force: true })
        } catch (e) {
            console.error('[SafeMode] No se pudo restaurar options.txt:', e)
        }
    }

    showToast(message, type) {
        let toast = document.getElementById('hero-toast')
        if (!toast) {
            toast = document.createElement('div')
            toast.id = 'hero-toast'
            document.querySelector('.home').appendChild(toast)
        }
        toast.textContent = message
        toast.className = 'hero-toast hero-toast-show' + (type === 'error' ? ' hero-toast-error' : '')
        clearTimeout(toast._hideTimer)
        toast._hideTimer = setTimeout(function() {
            toast.classList.remove('hero-toast-show')
        }, 3200)
    }

    // Aplica el fondo, el título y los tags según la instancia activa
    async applyInstanceTheme(instance) {
        if (!instance) return

        const playBtn      = document.getElementById('play-btn')
        const playBtnLabel = document.getElementById('play-btn-label')
        const homeBg       = document.getElementById('home-bg')
        const homeBgGrid   = document.getElementById('home-bg-grid')

        const displayName = instance.displayName || instance.name

        // Título del hero
        const titleEl = document.getElementById('hero-title')
        if (titleEl) titleEl.textContent = displayName

        // Descripción (campo "description" del backend — no lo expone el
        // panel de admin todavía, pero /instances ya lo pasa tal cual si
        // existe en el JSON, así que se muestra en cuanto una instancia lo tenga)
        const descEl = document.getElementById('hero-description')
        if (descEl) {
            if (instance.description) {
                descEl.textContent = instance.description
                descEl.style.display = '-webkit-box'
            } else {
                descEl.textContent = ''
                descEl.style.display = 'none'
            }
        }

        // Tags del hero (versión, loader, whitelist + etiquetas custom del panel)
        const tagsEl = document.getElementById('hero-tags')
        if (tagsEl) {
            const tags = []
            if (instance.loader && instance.loader.minecraft_version) {
                tags.push({ text: 'MC ' + instance.loader.minecraft_version })
            }
            if (instance.loader && instance.loader.loader_type && instance.loader.loader_type !== 'none') {
                tags.push({ text: instance.loader.loader_type })
            }
            if (instance.whitelistActive) {
                tags.push({ text: 'Privada' })
            }
            const catalog = this.tagsCatalogById
            const customTags = (instance.tags || [])
                .map(function(id) { return catalog ? catalog.get(id) : null })
                .filter(Boolean)

            tagsEl.innerHTML = tags.map(function(t) {
                return '<span class="hero-tag">' + escapeHtml(t.text) + '</span>'
            }).join('') + customTags.map(function(tag) {
                const style = 'background:' + escapeHtml(tag.color) + ';color:' + escapeHtml(contrastTextColor(tag.color))
                return '<span class="hero-tag hero-tag-custom" style="' + style + '">' + escapeHtml(tag.name) + '</span>'
            }).join('')
        }

        // Actualización del modpack: no hay forma de que minecraft-java-core
        // avise "hay archivos nuevos" antes de descargarlos (lo revisé a
        // fondo, no lo expone), así que lo aproximamos comparando un hash del
        // manifiesto (options.url) contra el que quedó guardado la última vez
        // que se jugó esta instancia. No es 100% preciso, pero evita que la
        // descarga arranque como sorpresa al apretar JUGAR.
        const needsModpackUpdate = await this.checkInstanceUpdate(instance)
        playBtn.classList.toggle('state-instance-update', needsModpackUpdate && !this.hasUpdate)

        // Label del botón de play con nombre de la instancia
        // (si ya hay una actualización del LAUNCHER pendiente, mantener
        // "ACTUALIZAR" apuntando a esa — tiene prioridad sobre el estado
        // de la instancia, así que el texto no debe volver a decir "JUGAR"
        // solo por cambiar de instancia)
        if (!this.hasUpdate) {
            playBtnLabel.textContent = needsModpackUpdate ? t('home.play.update') : t('home.play.label')
        }

        // Fondo
        if (instance.background) {
            homeBg.style.backgroundImage = 'url(' + instance.background + ')'
            homeBg.style.display = 'block'
            homeBgGrid.classList.remove('visible')
        } else {
            homeBg.style.backgroundImage = ''
            homeBgGrid.classList.add('visible')
        }

        await this.renderPlaytime(instance.name)
    }

    // ══════════════════════════════════════════════════════
    // ACTUALIZACIÓN DE MODPACK (hash del manifiesto, ver comentario arriba)
    // ══════════════════════════════════════════════════════

    async fetchManifestHash(url) {
        if (!url) return null
        try {
            const res = await nodeFetch(url)
            if (!res.ok) return null
            const text = await res.text()
            return crypto.createHash('sha1').update(text).digest('hex')
        } catch (e) {
            return null
        }
    }

    async checkInstanceUpdate(instance) {
        const hash = await this.fetchManifestHash(instance.url)
        if (!hash) return false

        const stored = await this.db.readData('modpackVersion', instance.name)
        if (!stored) {
            // Primera vez que se ve esta instancia: guarda el hash actual como
            // base sin marcarla como "hay que actualizar" (si no, la primera
            // instalación del launcher mostraría ACTUALIZAR en vez de JUGAR).
            await this.db.updateData('modpackVersion', { hash }, instance.name)
            return false
        }

        return stored.hash !== hash
    }

    // ══════════════════════════════════════════════════════
    // TIEMPO JUGADO
    // ══════════════════════════════════════════════════════

    async renderPlaytime(instanceName) {
        const label = document.getElementById('hero-playtime-label')
        if (!label) return

        const entry = await this.db.readData('playtime', instanceName)
        const seconds = (entry && entry.seconds) || 0

        if (seconds <= 0) {
            label.textContent = t('home.playtime.never')
            return
        }

        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        label.textContent = h > 0 ? (h + 'h ' + m + 'min') : (m + ' min')
    }

    async addPlaytime(instanceName, secondsPlayed) {
        if (!instanceName || secondsPlayed <= 0) return
        const entry = await this.db.readData('playtime', instanceName)
        const total = ((entry && entry.seconds) || 0) + secondsPlayed
        await this.db.updateData('playtime', { seconds: total }, instanceName)
        if (this.currentInstance && this.currentInstance.name === instanceName) {
            await this.renderPlaytime(instanceName)
        }
    }

    // ══════════════════════════════════════════════════════
    // LINK AL PANEL DE SKINS
    // ══════════════════════════════════════════════════════

    skinPanelLink() {
        // NOTA: el panel dedicado de gestión de skins fue removido del launcher.
        // No hay ".skins" registrado en createPanels(), así que no se activa
        // ningún cambio de panel aquí para evitar dejar la UI en blanco.
    }

    // ══════════════════════════════════════════════════════
    // INICIAR JUEGO
    // ══════════════════════════════════════════════════════

    // opts.safeMode: resetea video settings + desactiva resourcepacks para
    // este lanzamiento (ver applySafeVideoSettings) — igual que "modo
    // seguro" del launcher oficial de Mojang. No desactiva mods: el bundle
    // de minecraft-java-core redescarga cualquier archivo del manifest que
    // no encuentre en disco sin importar la lista "ignored" (lo confirmé
    // leyendo Minecraft-Bundle.js), así que sacar la carpeta mods de en
    // medio no sirve de nada — vuelve a bajarla antes de arrancar.
    //
    // opts.skipVerify ("Lanzamiento rápido"): fuerza verify:false para
    // saltar el hash-check profundo. Ojo — esto NO es un modo offline real:
    // GetAssetsOthers() siempre pega contra options.url (el manifiesto)
    // antes de decidir qué falta, con o sin verify, así que sigue
    // necesitando llegar al servidor.
    //
    // opts.verifyOnly ("Verificar archivos"): minecraft-java-core no tiene
    // un modo "solo verificar" — DownloadGame() siempre termina lanzando el
    // JVM. Se fuerza verify:true y se mata el proceso apenas arranca
    // (evento 'data'), así el usuario ve la descarga/verificación pero el
    // juego no llega a jugarse de verdad.
    async startGame(opts = {}) {
        const { safeMode = false, skipVerify = false, verifyOnly = false } = opts

        // Guardia de reentrada: un segundo click en JUGAR (o el auto-repeat
        // de Enter vía makeKeyActivatable) antes del primer await de más
        // abajo entraría acá una segunda vez en paralelo, armando un segundo
        // parche de child_process.spawn encima del primero y dejando
        // cpModule.spawn permanentemente envuelto cuando el más nuevo se
        // "restaura" al que ya no es el original. Se corta acá, síncrono,
        // antes de cualquier await.
        if (this.gameStarting) return
        this.gameStarting = true

        const self = this
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        // Sin el uuid, el backend no tiene forma de saber quién pregunta y
        // omite las instancias whitelistActive:true de la respuesta (ver
        // instancesSetup(), que sí lo manda) — options quedaba undefined
        // para cualquier instancia con whitelist y esto cortaba en silencio
        // más abajo, sin ningún error ni feedback visible.
        let instanceData = await config.getInstanceList(authenticator && authenticator.uuid)
        let options = instanceData.find(function(i) { return i.name === configClient.instance_select })

        if (!options) {
            this.gameStarting = false
            return
        }

        let safeModeBackup = null
        if (safeMode) safeModeBackup = await this.applySafeVideoSettings(options.name)

        const playBtn       = document.getElementById('play-btn')
        const moreWrap      = document.getElementById('hero-more-wrap')
        const infoBox       = document.getElementById('info-starting-game')
        const infoText      = document.getElementById('info-starting-text')
        const progressBar   = document.getElementById('progress-bar')
        const instanceRail  = document.getElementById('instance-popup')
        const forceCloseBtn = document.getElementById('force-close-btn')
        let playStartedAt   = null

        // minecraft-java-core no expone el proceso de Java que arranca
        // (revisé el código fuente instalado: Launch.js lo crea con
        // child_process.spawn y lo guarda solo en una variable local, no lo
        // devuelve ni lo emite en ningún evento). Como corre en el mismo
        // proceso de Node que este renderer, se puede interceptar la
        // siguiente llamada a spawn() para quedarse con la referencia real
        // y poder matarlo — es la única forma de tener un botón de "forzar
        // cierre" real dado lo que la librería expone hoy.
        const cpModule = require('child_process')
        const originalSpawn = cpModule.spawn
        let spawnPatched = true
        let minecraftProcess = null
        // OJO: no desparchar acá en el primer spawn() — para instancias con
        // Forge/loader, minecraft-java-core llama spawn() primero para CADA
        // processor del parcheador (Minecraft-Loader/patcher.js) antes de
        // spawnear el JVM real del juego (Launch.js). Si se restaura
        // cpModule.spawn en la primera llamada, se termina capturando un
        // proceso del parcheador (que ya cerró) en vez del juego, y
        // "Forzar cierre" queda muerto para cualquier partida que necesitó
        // parchear. Se sigue actualizando minecraftProcess en cada spawn()
        // — el último en pisar la referencia es siempre el correcto — y
        // recién se desparcha en 'data' (juego ya arrancó) o en
        // 'close'/'error' más abajo.
        cpModule.spawn = function(...args) {
            const proc = originalSpawn.apply(cpModule, args)
            minecraftProcess = proc
            return proc
        }
        function unpatchSpawn() {
            if (spawnPatched) {
                spawnPatched = false
                cpModule.spawn = originalSpawn
            }
        }

        // taskkill /F /T en vez de child.kill(): mata el árbol de procesos
        // completo (el proceso capturado + cualquier hijo), más robusto que
        // matar solo el PID exacto si Forge/NeoForge relanza el JVM durante
        // su propio arranque. En otras plataformas child.kill() ya alcanza.
        //
        // OJO — si "Forzar cierre" sigue sin matar el juego después de este
        // cambio: mirar este log en DevTools (Ctrl+Shift+I). Si el PID que
        // loguea ya no existe cuando se hace click (o taskkill dice "no se
        // encontró el proceso"), es que el JVM inicial se relanzó a sí mismo
        // y el proceso real del juego quedó en un PID que nunca capturamos —
        // eso necesitaría matar por nombre de proceso en vez de por PID.
        function killMinecraftProcess() {
            console.log('[force-close] click detectado, minecraftProcess:', minecraftProcess ? minecraftProcess.pid : null)
            if (minecraftProcess) {
                console.log('[force-close] matando PID', minecraftProcess.pid)
                if (process.platform === 'win32' && minecraftProcess.pid) {
                    cpModule.exec(`taskkill /PID ${minecraftProcess.pid} /F /T`, (err, stdout, stderr) => {
                        console.log('[force-close] taskkill resultado:', stdout || stderr || (err && err.message))
                    })
                } else {
                    minecraftProcess.kill()
                }
            }
            // Fallback para Forge/NeoForge: el bootstrap launcher (modlauncher
            // + bootstraplauncher, ver los argumentos con
            // "cpw.mods.bootstraplauncher") a veces relanza el JVM real con
            // otros flags de módulos y el proceso ORIGINAL que nosotros
            // spawneamos termina solo (dispara 'close' segundos después de
            // arrancar, mucho antes de que el jugador cierre el juego de
            // verdad — confirmado viendo el log). El juego real queda
            // corriendo en un proceso que nunca capturamos, así que
            // minecraftProcess puede estar null o apuntar a un proceso ya
            // muerto acá. Como respaldo, buscamos cualquier java(w).exe cuya
            // línea de comando tenga el nombre de ESTA instancia (los .jar
            // de sus mods están en el classpath, así que el nombre aparece
            // ahí) y lo matamos también — cubre tanto el caso normal como
            // el del relanzamiento.
            if (process.platform === 'win32' && options && options.name) {
                const safeName = String(options.name).replace(/'/g, "''")
                const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'javaw.exe' -or $_.Name -eq 'java.exe') -and $_.CommandLine -like '*${safeName}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
                cpModule.exec(`powershell -NoProfile -Command "${psCmd}"`, (err, stdout, stderr) => {
                    console.log('[force-close] fallback por línea de comando:', stdout || stderr || (err && err.message) || '(sin salida — no encontró nada que matar, o ya estaba muerto)')
                })
            }
        }

        // El botón es el mismo elemento del DOM entre partidas: si no se
        // saca el listener anterior, cada nueva partida apila uno más
        // (inofensivo porque los viejos apuntan a un proceso ya nulo, pero
        // sucio). Se guarda la referencia en el propio elemento para poder
        // reemplazarlo limpio cada vez.
        if (forceCloseBtn._killHandler) {
            forceCloseBtn.removeEventListener('click', forceCloseBtn._killHandler)
        }
        forceCloseBtn._killHandler = killMinecraftProcess
        forceCloseBtn.addEventListener('click', forceCloseBtn._killHandler)

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loader.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,
            loader: {
                type: options.loader.loader_type,
                build: normalizeLoaderBuild(options.loader),
                enable: options.loader.loader_type == 'none' ? false : true
            },
            verify: verifyOnly ? true : (skipVerify ? false : options.verify),
            ignored: [...options.ignored],
            java: { path: configClient.java_config.java_path },
            JVM_ARGS:  options.jvm_args  ? options.jvm_args  : [],
            GAME_ARGS: options.game_args ? options.game_args : [],
            screen: {
                width:  configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        launch.Launch(opt)

        playBtn.style.display = 'none'
        if (moreWrap) moreWrap.style.display = 'none'
        instanceRail.style.display = 'none'
        infoBox.style.display = 'block'
        progressBar.style.display = ''
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', function(e) {
            ipcRenderer.send('main-window-progress-load')
            console.log(e)
        })

        launch.on('progress', function(progress, size) {
            infoText.textContent = t('home.status.downloading') + ' ' + ((progress / size) * 100).toFixed(0) + '%'
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress
            progressBar.max = size
        })

        launch.on('check', function(progress, size) {
            infoText.textContent = t('home.status.verifying') + ' ' + ((progress / size) * 100).toFixed(0) + '%'
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress
            progressBar.max = size
        })

        launch.on('estimated', function(time) {
            let h = Math.floor(time / 3600)
            let m = Math.floor((time - h * 3600) / 60)
            let s = Math.floor(time - h * 3600 - m * 60)
            console.log(h + 'h ' + m + 'm ' + s + 's')
        })

        launch.on('speed', function(speed) {
            console.log((speed / 1067008).toFixed(2) + ' Mb/s')
        })

        launch.on('patch', function(patch) {
            console.log(patch)
            ipcRenderer.send('main-window-progress-load')
            infoText.textContent = t('home.status.patching')
        })

        launch.on('data', function(e) {
            progressBar.style.display = 'none'
            unpatchSpawn() // el proceso ya arrancó y quedó capturado, no hace falta seguir interceptando
            // La descarga/verificación terminó bien: el manifiesto que se
            // acaba de usar queda como "conocido" para esta instancia, así
            // que la próxima vez el botón vuelve a decir JUGAR en vez de
            // ACTUALIZAR (a menos que el manifiesto vuelva a cambiar).
            self.fetchManifestHash(options.url).then(function(hash) {
                if (hash) self.db.updateData('modpackVersion', { hash }, options.name)
            })

            if (verifyOnly) {
                // "Verificar archivos": la descarga/verificación ya
                // terminó (es lo único que interesaba) — se mata el JVM
                // recién arrancado antes de que llegue a mostrar nada,
                // minecraft-java-core no tiene un modo "solo verificar".
                killMinecraftProcess()
                return
            }

            playStartedAt = Date.now()
            forceCloseBtn.style.display = 'flex'
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('discord-rpc-destroy')
                ipcRenderer.send('main-window-hide')
            }
            new logger('Minecraft', '#36b030')
            ipcRenderer.send('main-window-progress-load')
            infoText.textContent = t('home.status.playing')
            console.log(e)
        })

        launch.on('close', async function(code) {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('main-window-show')
                ipcRenderer.send('discord-rpc-init')
            }
            if (playStartedAt) {
                self.addPlaytime(options.name, Math.round((Date.now() - playStartedAt) / 1000))
                playStartedAt = null
            }
            if (safeModeBackup) await self.restoreSafeVideoSettings(options.name, safeModeBackup)
            unpatchSpawn()
            minecraftProcess = null
            self.gameStarting = false
            forceCloseBtn.style.display = 'none'
            ipcRenderer.send('main-window-progress-reset')
            infoBox.style.display = 'none'
            playBtn.style.display = ''
            if (moreWrap) moreWrap.style.display = ''
            instanceRail.style.display = ''
            infoText.textContent = t('home.status.verifying')
            new logger(pkg.name, '#7289da')
            console.log('Close')
            if (verifyOnly) self.showToast(t('home.more.verify.done'))
            // Refresca el botón (JUGAR/ACTUALIZAR) por si el hash del
            // manifiesto cambió con esta partida (ver evento 'data' arriba).
            if (self.currentInstance) self.applyInstanceTheme(self.currentInstance)
        })

        launch.on('error', async function(err) {
            console.log('[Launch Error]', err)
            let errorMsg = err ? (err.error || err.message || JSON.stringify(err)) : 'Error desconocido'
            let popupError = new popup()
            popupError.openPopup({ title: 'Error', content: errorMsg, color: 'red', options: true })
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('main-window-show')
            }
            if (playStartedAt) {
                self.addPlaytime(options.name, Math.round((Date.now() - playStartedAt) / 1000))
                playStartedAt = null
            }
            if (safeModeBackup) await self.restoreSafeVideoSettings(options.name, safeModeBackup)
            unpatchSpawn()
            minecraftProcess = null
            self.gameStarting = false
            forceCloseBtn.style.display = 'none'
            ipcRenderer.send('main-window-progress-reset')
            infoBox.style.display = 'none'
            playBtn.style.display = ''
            if (moreWrap) moreWrap.style.display = ''
            instanceRail.style.display = ''
            infoText.textContent = t('home.status.verifying')
            new logger(pkg.name, '#7289da')
        })
    }

    // ══════════════════════════════════════════════════════
    // CHECK UPDATE — botón azul si hay actualización
    // ══════════════════════════════════════════════════════

    async checkUpdate() {
        try {
            const version = pkg.version
            const res = await nodeFetch('https://api.github.com/repos/GhanxocS/MetalDaze-Launcher/releases/latest')
            if (!res.ok) return
            const data = await res.json()
            const latest = data.tag_name ? data.tag_name.replace('v', '') : null
            if (!latest) return

            const current = version.split('.').map(Number)
            const remote  = latest.split('.').map(Number)

            let hasUpdate = false
            for (let i = 0; i < 3; i++) {
                if ((remote[i] || 0) > (current[i] || 0)) { hasUpdate = true; break }
                if ((remote[i] || 0) < (current[i] || 0)) break
            }

            if (hasUpdate) {
                this.hasUpdate = true
                this.updateUrl = data.html_url
                const playBtn      = document.getElementById('play-btn')
                const playBtnLabel = document.getElementById('play-btn-label')
                if (playBtn) {
                    playBtn.classList.add('state-update')
                    playBtnLabel.textContent = 'ACTUALIZAR'
                }
            }
        } catch(e) {
            console.log('Update check failed:', e)
        }
    }

    // ══════════════════════════════════════════════════════
    // UTILS
    // ══════════════════════════════════════════════════════

    getdate(e) {
        let date = new Date(e)
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
        return { month: allMonth[month - 1], day: day }
    }
}

export default Home;
