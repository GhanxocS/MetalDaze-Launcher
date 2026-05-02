/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Modificado para MetalDaze Launcher — v1.2
 * Añadido: modal de cambio de skins con historial local
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup, skin2D } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const nodeFetch = require('node-fetch')
const FormData = require('form-data')

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        let configClient = await this.db.readData('configClient')
let auth = await this.db.readData('accounts', configClient.account_selected)
if (auth?.uuid && auth?.name) {
    nodeFetch(`${this.config.url || 'https://metaldaze-backend-production.up.railway.app'}/players/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: auth.uuid, name: auth.name })
    }).catch(err => console.error('[players] Error registrando jugador:', err))
}
        this.news()
        this.socialLick()
        this.instancesSelect()
        this.skinModal()
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))
        this.checkUpdate()
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews(this.config).then(res => res).catch(err => false);
        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                const date = this.getdate(new Date())
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon/icon.png">
                        <div class="header-text">
                            <div class="title">Por el momento no hay noticias disponibles.</div>
                        </div>
                        <div class="date">
                            <div class="day">${date.day}</div>
                            <div class="month">${date.month}</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Vous pourrez suivre ici toutes les news relative au serveur.</p>
                        </div>
                    </div>`
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date)
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '</br>')}</p>
                                <p class="news-author">Autor - <span>${News.author}</span></p>
                            </div>
                        </div>`
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            const date = this.getdate(new Date())
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon/icon.png">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">${date.day}</div>
                            <div class="month">${date.month}</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Impossible de contacter le serveur des news.</br>Merci de vérifier votre configuration.</p>
                        </div>
                    </div>`
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block, .social-block-sidebar')
        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.currentTarget.dataset.url)
            })
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let instancesList = await config.getInstanceList()
        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_select) ? configClient?.instance_select : null

        let instanceBTN = document.querySelector('.play-instance')
        let instancePopup = document.querySelector('.instance-popup')
        let instancesListPopup = document.querySelector('.instances-List')
        let instanceCloseBTN = document.querySelector('.close-popup')

        instancesList = instancesList.filter(i => {
    if (!i.whitelistActive) return true
    return i.whitelist && i.whitelist.find(w => w === auth?.uuid)
})

if (instancesList.length === 0) {
    let playInstance = document.querySelector('.play-instance')
    let instanceSelect = document.querySelector('.instance-select')
    if (playInstance) playInstance.style.display = 'none'
    if (instanceSelect) instanceSelect.style.display = 'none'
    return
}

        if (!instanceSelect) {
    let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
    if (!newInstanceSelect) {
        // No hay instancias públicas disponibles
        document.querySelector('.play-instance').style.display = 'none'
        return
    }
    let configClient = await this.db.readData('configClient')
    configClient.instance_select = newInstanceSelect.name
    instanceSelect = newInstanceSelect.name
    await this.db.updateData('configClient', configClient)
}

for (let instance of instancesList) {
    if (instance.whitelistActive) {
        let whitelist = instance.whitelist.find(w => w === auth?.uuid)
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        let configClient = await this.db.readData('configClient')
                        configClient.instance_select = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        setStatus(newInstanceSelect.status)
                        await this.db.updateData('configClient', configClient)
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`)
            if (instance.name == instanceSelect) setStatus(instance.status)
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id
                let activeInstanceSelect = document.querySelector('.active-instance')

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_select = newInstanceSelect
                await this.db.updateData('configClient', configClient)
                instanceSelect = instancesList.filter(i => i.name == newInstanceSelect)
                instancePopup.style.display = 'none'
                let instance = await config.getInstanceList()
                let options = instance.find(i => i.name == configClient.instance_select)
                await setStatus(options.status)
            }
        })

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')
            let instanceSelect = configClient.instance_select
            let auth = await this.db.readData('accounts', configClient.account_selected)

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = ''
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                                if (whitelist === auth?.uuid) {
                                if (instance.name == instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                                }
                            }
                        })
                    } else {
                        if (instance.name == instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                        }
                    }
                }

                instancePopup.style.display = 'flex'
            }

            if (!e.target.classList.contains('instance-select')) this.startGame()
        })

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')
    }

    // ══════════════════════════════════════════════════════
    // SKIN MODAL
    // ══════════════════════════════════════════════════════

    async skinModal() {
        // ── Elementos del DOM ──
        const overlay     = document.getElementById('skin-modal-overlay')
        const closeBtn    = document.getElementById('skin-modal-close')
        const uploadZone  = document.getElementById('skin-upload-zone')
        const fileInput   = document.getElementById('skin-file-input')
        const selectedLbl = document.getElementById('skin-selected-file')
        const applyBtn    = document.getElementById('skin-apply-btn')
        const statusEl    = document.getElementById('skin-status')
        const previewCvs  = document.getElementById('skin-preview-canvas')
        const historyGrid = document.getElementById('skin-history-grid')

        // Estado interno
        let selectedFile    = null   // File object del archivo PNG elegido
        let selectedVariant = 'CLASSIC'
        let pendingBase64   = null   // base64 del archivo para previsualizar

        // ── Ruta del historial local ──
        // Se guarda en %appdata%/.MetalDaze/skin-history.json
        const appdataPath    = await ipcRenderer.invoke('appData')
        const historyDir     = path.join(appdataPath, '.MetalDaze')
        const historyFile    = path.join(historyDir, 'skin-history.json')

        // ── Abrir modal al click en player-head ──
        document.getElementById('open-skin-modal').addEventListener('click', async () => {
            selectedFile  = null
            pendingBase64 = null
            selectedLbl.textContent = 'Ningún archivo seleccionado'
            applyBtn.classList.remove('ready', 'loading')
            statusEl.textContent = ''
            statusEl.className = 'skin-status'

            // Mostrar skin actual en el preview
            const configClient = await this.db.readData('configClient')
            const auth = await this.db.readData('accounts', configClient.account_selected)
            if (auth?.profile?.skins?.[0]?.base64) {
                await this.renderSkinPreview(previewCvs, auth.profile.skins[0].base64)
                selectedVariant = auth.profile.skins[0].variant || 'CLASSIC'
                this.updateVariantBtns(selectedVariant)
            }

            await this.renderHistory(historyGrid, historyFile, previewCvs, async (entry) => {
                // Callback: usuario clickeó una skin del historial → previsualizar
                pendingBase64   = entry.base64
                selectedFile    = null
                selectedVariant = entry.variant || 'CLASSIC'
                selectedLbl.innerHTML = `Seleccionado del historial: <span>${entry.name}</span>`
                applyBtn.classList.add('ready')
                this.updateVariantBtns(selectedVariant)
                await this.renderSkinPreview(previewCvs, entry.base64)
            })

            overlay.classList.add('open')
            document.body.style.overflow = 'hidden'
        })

        // ── Cerrar modal ──
        const closeSkinModal = () => {
            overlay.classList.remove('open')
            document.body.style.overflow = ''
        }

        closeBtn.addEventListener('click', closeSkinModal)
        overlay.addEventListener('click', e => { if (e.target === overlay) closeSkinModal() })

        // ── Selector de variante ──
        document.querySelectorAll('.skin-variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedVariant = btn.dataset.variant
                this.updateVariantBtns(selectedVariant)
            })
        })

        // ── Upload zone → abrir file picker ──
        uploadZone.addEventListener('click', () => fileInput.click())

        // Drag & drop
        uploadZone.addEventListener('dragover', e => {
            e.preventDefault()
            uploadZone.style.borderColor = 'var(--md-white)'
        })
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'var(--md-border-lit)'
        })
        uploadZone.addEventListener('drop', async e => {
            e.preventDefault()
            uploadZone.style.borderColor = 'var(--md-border-lit)'
            const file = e.dataTransfer.files[0]
            if (file) await this.handleSkinFile(file, selectedLbl, applyBtn, previewCvs, (b64) => { pendingBase64 = b64; selectedFile = file })
        })

        // ── File input change ──
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0]
            if (file) await this.handleSkinFile(file, selectedLbl, applyBtn, previewCvs, (b64) => { pendingBase64 = b64; selectedFile = file })
        })

        // ── Aplicar skin ──
        applyBtn.addEventListener('click', async () => {
            if (!pendingBase64) return

            applyBtn.classList.add('loading')
            applyBtn.textContent = 'APLICANDO...'
            statusEl.textContent = ''
            statusEl.className = 'skin-status'

            try {
                const configClient = await this.db.readData('configClient')
                const auth = await this.db.readData('accounts', configClient.account_selected)

                // Convertir base64 a Blob para la API de Mojang
                const FormData = require('form-data')

// Convertir base64 a Buffer
const base64Data = pendingBase64.replace(/^data:image\/png;base64,/, '')
const buffer = Buffer.from(base64Data, 'base64')

const formData = new FormData()
formData.append('variant', selectedVariant.toLowerCase())
formData.append('file', buffer, {
    filename: selectedFile ? selectedFile.name : 'skin.png',
    contentType: 'image/png'
})

const mojangRes = await nodeFetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${auth.access_token}`,
        ...formData.getHeaders()
    },
    body: formData
})

                if (!mojangRes.ok) {
                    const err = await mojangRes.json().catch(() => ({}))
                    throw new Error(err.errorMessage || `Error ${mojangRes.status}`)
                }

                // Guardar en historial local
                const skinName = selectedFile ? selectedFile.name.replace('.png', '') : `skin_${Date.now()}`
                await this.saveToHistory(historyFile, historyDir, {
                    name: skinName,
                    base64: pendingBase64,
                    variant: selectedVariant,
                    date: Date.now()
                })

                // Actualizar el player-head en la sidebar
                const headTexture = await new skin2D().creatHeadTexture(pendingBase64)
                document.querySelector('.player-head').style.backgroundImage = `url(${headTexture})`

                // Refrescar historial
                await this.renderHistory(historyGrid, historyFile, previewCvs, async (entry) => {
                    pendingBase64   = entry.base64
                    selectedFile    = null
                    selectedVariant = entry.variant || 'CLASSIC'
                    selectedLbl.innerHTML = `Seleccionado del historial: <span>${entry.name}</span>`
                    applyBtn.classList.add('ready')
                    this.updateVariantBtns(selectedVariant)
                    await this.renderSkinPreview(previewCvs, entry.base64)
                })

                statusEl.textContent = '¡Skin aplicada correctamente!'
                statusEl.className = 'skin-status success'
                applyBtn.textContent = 'APLICAR SKIN'
                applyBtn.classList.remove('loading')

            } catch (err) {
                console.error('[skin] Error al aplicar skin:', err)
                statusEl.textContent = `Error: ${err.message}`
                statusEl.className = 'skin-status error'
                applyBtn.textContent = 'APLICAR SKIN'
                applyBtn.classList.remove('loading')
            }
        })
    }

    // ── Procesa el archivo PNG seleccionado ──
    async handleSkinFile(file, selectedLbl, applyBtn, previewCvs, onReady) {
        if (!file.name.endsWith('.png')) {
            selectedLbl.textContent = 'El archivo debe ser PNG'
            return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
            const base64 = e.target.result
            selectedLbl.innerHTML = `Archivo: <span>${file.name}</span>`
            applyBtn.classList.add('ready')
            onReady(base64)
            await this.renderSkinPreview(previewCvs, base64)
        }
        reader.readAsDataURL(file)
    }

    // ── Renderiza la cabeza en el canvas de preview ──
    async renderSkinPreview(canvas, base64) {
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, 8, 8)
                // Capa base de la cabeza
                ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8)
                // Capa exterior (sombrero/overlay)
                ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8)
                resolve()
            }
            img.src = base64
        })
    }

    // ── Actualiza los botones de variante activos ──
    updateVariantBtns(variant) {
        document.querySelectorAll('.skin-variant-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.variant === variant)
        })
    }

    // ── Lee el historial local ──
    loadHistory(historyFile) {
        try {
            if (fs.existsSync(historyFile)) {
                return JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
            }
        } catch {}
        return []
    }

    // ── Guarda una skin en el historial (máx 12) ──
    async saveToHistory(historyFile, historyDir, entry) {
        try {
            if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true })
            let history = this.loadHistory(historyFile)
            // Evitar duplicados por base64
            history = history.filter(h => h.base64 !== entry.base64)
            history.unshift(entry)
            if (history.length > 12) history = history.slice(0, 12)
            fs.writeFileSync(historyFile, JSON.stringify(history, null, 2))
        } catch (err) {
            console.error('[skin] Error guardando historial:', err)
        }
    }

    // ── Renderiza el grid del historial ──
    async renderHistory(grid, historyFile, previewCvs, onSelect) {
        const history = this.loadHistory(historyFile)
        grid.innerHTML = ''

        if (!history.length) {
            grid.innerHTML = '<div class="skin-history-empty">Sin historial</div>'
            return
        }

        for (const entry of history) {
            const item = document.createElement('div')
            item.className = 'skin-history-item'

            const cvs = document.createElement('canvas')
            cvs.className = 'skin-history-canvas'
            cvs.width = 8
            cvs.height = 8

            // Renderizar la cabeza en el canvas del historial
            await new Promise((resolve) => {
                const img = new Image()
                img.onload = () => {
                    const ctx = cvs.getContext('2d')
                    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8)
                    ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8)
                    resolve()
                }
                img.src = entry.base64
            })

            const nameLbl = document.createElement('div')
            nameLbl.className = 'skin-history-name'
            nameLbl.textContent = entry.name

            const delBtn = document.createElement('div')
            delBtn.className = 'skin-history-delete'
            delBtn.textContent = '✕'
            delBtn.title = 'Eliminar del historial'

            item.appendChild(cvs)
            item.appendChild(nameLbl)
            item.appendChild(delBtn)

            // Click en el item → seleccionar para aplicar
            item.addEventListener('click', async (e) => {
                if (e.target === delBtn) return
                document.querySelectorAll('.skin-history-item').forEach(i => i.classList.remove('active-skin'))
                item.classList.add('active-skin')
                await onSelect(entry)
            })

            // Click en borrar → eliminar del historial
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation()
                let history = this.loadHistory(historyFile)
                history = history.filter(h => h.date !== entry.date)
                try {
                    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2))
                } catch {}
                await this.renderHistory(grid, historyFile, previewCvs, onSelect)
            })

            grid.appendChild(item)
        }
    }

    // ══════════════════════════════════════════════════════
    // START GAME
    // ══════════════════════════════════════════════════════

    async startGame() {
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instance = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name == configClient.instance_select)

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

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

            java: {
                path: configClient.java_config.java_path,
            },

            JVM_ARGS:  options.jvm_args ? options.jvm_args : [],
            GAME_ARGS: options.game_args ? options.game_args : [],

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        console.log('[Launch Options]', JSON.stringify(opt, null, 2))
        launch.Launch(opt);


        launch.Launch(opt);

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', e => console.log('[extract]', e))
        launch.on('progress', (p, s) => console.log('[progress]', p, s))
        launch.on('check', (p, s) => console.log('[check]', p, s))
        launch.on('patch', e => console.log('[patch]', e))
        launch.on('data', e => console.log('[data]', e))

        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            console.log(extract);
        });

        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Descargando ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Verificando ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('estimated', (time) => {
            let hours = Math.floor(time / 3600);
            let minutes = Math.floor((time - hours * 3600) / 60);
            let seconds = Math.floor(time - hours * 3600 - minutes * 60);
            console.log(`${hours}h ${minutes}m ${seconds}s`);
        })

        launch.on('speed', (speed) => {
            console.log(`${(speed / 1067008).toFixed(2)} Mb/s`)
        })

        launch.on('patch', patch => {
            console.log(patch);
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Aplicando parches...`
        });

        launch.on('data', (e) => {
            progressBar.style.display = "none"
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            };
            new logger('Minecraft', '#36b030');
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Juego en curso...`
            console.log(e);
        })

        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Verificando`
            new logger(pkg.name, '#7289da');
            console.log('Close');
        });

        launch.on('error', err => {
    console.log('[Launch Error Raw]', err)
    let errorMsg = 'Error desconocido al iniciar el juego'
    if (err) {
        errorMsg = err.error || err.message || JSON.stringify(err)
    }
    let popupError = new popup()
    popupError.openPopup({
        title: 'Error',
        content: errorMsg,
        color: 'red',
        options: true
    })

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Verificando`
            new logger(pkg.name, '#7289da');
            console.log(err);
        });
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }

    async checkUpdate() {
        try {
            const { version } = require('../../../package.json');
            const res = await fetch('https://api.github.com/repos/GhanxocS/MetalDaze-Launcher/releases/latest');
            if (!res.ok) return;
            const data = await res.json();
            const latest = data.tag_name?.replace('v', '');
            if (!latest) return;

            const current = version.split('.').map(Number);
            const remote = latest.split('.').map(Number);

            let hasUpdate = false;
            for (let i = 0; i < 3; i++) {
                if ((remote[i] || 0) > (current[i] || 0)) { hasUpdate = true; break; }
                if ((remote[i] || 0) < (current[i] || 0)) break;
            }

            if (hasUpdate) {
                const btn = document.querySelector('.update-btn');
                if (btn) {
                    btn.style.display = 'flex';
                    btn.addEventListener('click', () => {
                        shell.openExternal(data.html_url);
                    });
                }
            }
        } catch(e) {
            console.log('Update check failed:', e);
        }
    }
}
export default Home;
