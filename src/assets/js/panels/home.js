/**
 * @author Luuxis / ITakerMetal
 * MetalDaze Launcher — Home Panel REWORK v3.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup, skin2D, escapeHtml } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const nodeFetch = require('node-fetch')

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.instancesList = [];
        this.currentInstance = null;
        this.hasUpdate = false;
        this.updateUrl = null;

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

        document.querySelector('.settings-btn').addEventListener('click', function() {
            changePanel('settings')
        })
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
                    <img class="featured-news-icon" src="assets/images/icon/icon.png">
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
                        <img class="server-status-icon" src="assets/images/icon/icon.png">
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
                    <img class="featured-news-icon" src="assets/images/icon/icon.png">
                    <div class="featured-news-title">${news === false ? 'Sin conexión al servidor de noticias.' : 'Sin noticias por el momento.'}</div>
                </div>
                <div class="featured-news-body">Vuelve más tarde para ver las últimas noticias de MetalDaze.</div>
            `
        }

        // Toggle panel todas las noticias
        document.getElementById('all-news-link').addEventListener('click', function() {
            document.getElementById('all-news-panel').style.display = 'flex'
        })
        document.getElementById('all-news-back').addEventListener('click', function() {
            document.getElementById('all-news-panel').style.display = 'none'
        })
    }

    // ══════════════════════════════════════════════════════
    // REDES SOCIALES
    // ══════════════════════════════════════════════════════

    socialLinks() {
        document.querySelectorAll('.social-block-sidebar').forEach(function(el) {
            el.addEventListener('click', function(e) {
                shell.openExternal(e.currentTarget.dataset.url)
            })
        })
    }

    // ══════════════════════════════════════════════════════
    // INSTANCIAS Y BOTÓN DE PLAY
    // ══════════════════════════════════════════════════════

    async instancesSetup() {
        const self = this
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let allInstances = await config.getInstanceList()

        // Filtrar por whitelist
        this.instancesList = allInstances.filter(function(i) {
            if (!i.whitelistActive) return true
            return i.whitelist && i.whitelist.find(function(w) { return w === (auth && auth.uuid) })
        })

        const playBtn           = document.getElementById('play-btn')
        const playBtnLabel      = document.getElementById('play-btn-label')
        const selectorBtn       = document.getElementById('instance-selector-btn')
        const selectorLabel     = document.getElementById('instance-selector-label')
        const instancePopup     = document.getElementById('instance-popup')
        const instancesListEl   = document.getElementById('instances-list-popup')
        const closePopupBtn     = document.getElementById('close-instance-popup')
        const homeBg            = document.getElementById('home-bg')
        const homeBgGrid        = document.getElementById('home-bg-grid')
        const infoStarting      = document.getElementById('info-starting-game')

        // Sin instancias disponibles
        if (this.instancesList.length === 0) {
            selectorBtn.style.display = 'none'
            playBtn.classList.remove("state-update")
            playBtn.classList.add('state-no-instance')
            playBtnLabel.textContent = 'SIN INSTANCIA'
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
        this.applyInstanceTheme(this.currentInstance, playBtnLabel, selectorLabel, homeBg, homeBgGrid)

        // Ocultar selector si solo hay una instancia
        if (this.instancesList.length === 1) {
            selectorBtn.style.display = 'none'
        }

        // Abrir popup selector
        selectorBtn.addEventListener('click', function() {
            instancesListEl.innerHTML = ''
            for (let inst of self.instancesList) {
                const el = document.createElement('div')
                el.className = 'instance-elements' + (inst.name === instanceSelect ? ' active-instance' : '')
                el.id = inst.name
                el.textContent = inst.displayName || inst.name
                instancesListEl.appendChild(el)
            }
            instancePopup.style.display = 'flex'
        })

        closePopupBtn.addEventListener('click', function() {
            instancePopup.style.display = 'none'
        })

        instancePopup.addEventListener('click', async function(e) {
            if (e.target === instancePopup) instancePopup.style.display = 'none'
            if (!e.target.classList.contains('instance-elements')) return

            const newName = e.target.id
            document.querySelectorAll('.instance-elements').forEach(function(el) {
                el.classList.toggle('active-instance', el.id === newName)
            })

            instanceSelect = newName
            let cfg = await self.db.readData('configClient')
            cfg.instance_select = newName
            await self.db.updateData('configClient', cfg)

            self.currentInstance = self.instancesList.find(function(i) { return i.name === newName })
            self.applyInstanceTheme(self.currentInstance, playBtnLabel, selectorLabel, homeBg, homeBgGrid)
            instancePopup.style.display = 'none'
        })

        // Botón de play
        playBtn.addEventListener('click', async function() {
            if (playBtn.classList.contains('state-no-instance')) return

            if (playBtn.classList.contains('state-update')) {
                if (self.updateUrl) shell.openExternal(self.updateUrl)
                return
            }

            await self.startGame()
        })
    }

    // Aplica el fondo y el label según la instancia activa
    applyInstanceTheme(instance, playBtnLabel, selectorLabel, homeBg, homeBgGrid) {
        if (!instance) return

        // Label del selector
        const displayName = instance.displayName || instance.name
        selectorLabel.textContent = displayName

        // Label del botón de play con nombre de la instancia
        // (si ya se detectó una actualización pendiente, mantener "ACTUALIZAR" —
        // el botón sigue apuntando a la descarga de la nueva versión, así que el
        // texto no debe volver a decir "JUGAR" solo por cambiar de instancia)
        if (!this.hasUpdate) {
            const version = instance.loader && instance.loader.minecraft_version
                ? ' — ' + instance.loader.minecraft_version
                : ''
            playBtnLabel.textContent = 'JUGAR' + version
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

    async startGame() {
        const self = this
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instanceData = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instanceData.find(function(i) { return i.name === configClient.instance_select })

        if (!options) return

        const playBtn       = document.getElementById('play-btn')
        const infoBox       = document.getElementById('info-starting-game')
        const infoText      = document.getElementById('info-starting-text')
        const progressBar   = document.getElementById('progress-bar')
        const selectorBtn   = document.getElementById('instance-selector-btn')

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
                build: options.loader.loader_version,
                enable: options.loader.loader_type == 'none' ? false : true
            },
            verify: options.verify,
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
        selectorBtn.style.display = 'none'
        infoBox.style.display = 'block'
        progressBar.style.display = ''
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', function(e) {
            ipcRenderer.send('main-window-progress-load')
            console.log(e)
        })

        launch.on('progress', function(progress, size) {
            infoText.textContent = 'Descargando ' + ((progress / size) * 100).toFixed(0) + '%'
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress
            progressBar.max = size
        })

        launch.on('check', function(progress, size) {
            infoText.textContent = 'Verificando ' + ((progress / size) * 100).toFixed(0) + '%'
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
            infoText.textContent = 'Aplicando parches...'
        })

        launch.on('data', function(e) {
            progressBar.style.display = 'none'
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('discord-rpc-destroy')
                ipcRenderer.send('main-window-hide')
            }
            new logger('Minecraft', '#36b030')
            ipcRenderer.send('main-window-progress-load')
            infoText.textContent = 'Juego en curso...'
            console.log(e)
        })

        launch.on('close', function(code) {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('main-window-show')
                ipcRenderer.send('discord-rpc-init')
            }
            ipcRenderer.send('main-window-progress-reset')
            infoBox.style.display = 'none'
            playBtn.style.display = ''
            if (self.instancesList.length > 1) selectorBtn.style.display = ''
            infoText.textContent = 'Verificando'
            new logger(pkg.name, '#7289da')
            console.log('Close')
        })

        launch.on('error', function(err) {
            console.log('[Launch Error]', err)
            let errorMsg = err ? (err.error || err.message || JSON.stringify(err)) : 'Error desconocido'
            let popupError = new popup()
            popupError.openPopup({ title: 'Error', content: errorMsg, color: 'red', options: true })
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send('main-window-show')
            }
            ipcRenderer.send('main-window-progress-reset')
            infoBox.style.display = 'none'
            playBtn.style.display = ''
            if (self.instancesList.length > 1) selectorBtn.style.display = ''
            infoText.textContent = 'Verificando'
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
