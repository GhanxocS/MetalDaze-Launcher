/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Modificado para MetalDaze Launcher — v1.1
 * Añadido: bloque de almacenamiento (storage()) en pestaña LAUNCHER
 */

import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata, setBackground } from '../utils.js'
const { ipcRenderer } = require('electron');
const os = require('os');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN()
        this.accounts()
        this.ram()
        this.javaPath()
        this.resolution()
        this.launcher()
        this.storage()   // ← nuevo
    }

    navBTN() {
        document.querySelector('#save').addEventListener('click', () => {
            let activeSettingsBTN = document.querySelector('.active-settings-BTN');
            if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
            document.querySelector('#account').classList.add('active-settings-BTN');

            let activeContainerSettings = document.querySelector('.active-container-settings');
            if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
            document.querySelector('#account-tab').classList.add('active-container-settings');

            changePanel('home');
        });

        document.querySelector('.nav-box').addEventListener('click', e => {
            if (e.target.classList.contains('nav-settings-btn')) {
                let id = e.target.id;

                let activeSettingsBTN = document.querySelector('.active-settings-BTN');
                let activeContainerSettings = document.querySelector('.active-container-settings');

                if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
                e.target.classList.add('active-settings-BTN');

                if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
                document.querySelector(`#${id}-tab`).classList.add('active-container-settings');

                if (id === 'java' && !this.sliderInitialized) {
                    this.sliderInitialized = true;
                    this.initSlider();
                }
            }
        });
    }

    accounts() {
        // Limpiar cuentas duplicadas del DOM excepto el botón "add"
        let accountList = document.querySelector('.accounts-list');
        let existingAccounts = accountList.querySelectorAll('.account:not(#add)');
        existingAccounts.forEach(acc => acc.remove());

        document.querySelector('.accounts-list').addEventListener('click', async e => {
            let popupAccount = new popup()
            try {
                let accountEl = e.target.closest('.account')
                if (!accountEl) return
                let id = parseInt(accountEl.id)

                // Click en borrar cuenta
                if (e.target.closest('.delete-profile')) {
                    popupAccount.openPopup({
                        title: 'Eliminando cuenta',
                        content: 'Por favor, espere...',
                        color: 'var(--color)'
                    })

                    await this.db.deleteData('accounts', id)
                    accountEl.remove()

                    let accountListElement = document.querySelector('.accounts-list')
                    let remaining = accountListElement.querySelectorAll('.account:not(#add)')

                    if (remaining.length == 0) {
                        let configClient = await this.db.readData('configClient')
                        configClient.account_selected = null
                        await this.db.updateData('configClient', configClient)
                        setTimeout(() => ipcRenderer.send('main-window-login-size'), 50)
                        setTimeout(() => changePanel('login'), 100)
                        return
                    }

                    let configClient = await this.db.readData('configClient')
                    if (configClient.account_selected == id) {
                        let allAccounts = await this.db.readAllData('accounts')
                        configClient.account_selected = allAccounts[0].ID
                        await accountSelect(allAccounts[0])
                        let newConfig = await this.setInstance(allAccounts[0])
                        configClient.instance_select = newConfig.instance_select
                        await this.db.updateData('configClient', configClient)
                    }
                    return
                }

                // Click en seleccionar cuenta
                popupAccount.openPopup({
                    title: 'Iniciar sesión',
                    content: 'Por favor, espere...',
                    color: 'var(--color)'
                })

                if (accountEl.id == 'add') {
                    document.querySelector('.cancel-home').style.display = 'inline'
                    setTimeout(() => ipcRenderer.send('main-window-login-size'), 50)
                    setTimeout(() => changePanel('login'), 100)
                    return
                }

                let account = await this.db.readData('accounts', id)
                let configClient = await this.setInstance(account)
                await accountSelect(account)
                configClient.account_selected = account.ID
                return await this.db.updateData('configClient', configClient)

            } catch (err) {
                console.error(err)
            } finally {
                popupAccount.closePopup()
            }
        })
    }

    async setInstance(auth) {
        let configClient = await this.db.readData('configClient')
        let instanceSelect = configClient.instance_select
        let instancesList = await config.getInstanceList()

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth.name)
                if (whitelist !== auth.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_select = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }
        return configClient
    }

    async ram() {
        let config = await this.db.readData('configClient');
        let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} GB`;
        document.getElementById("free-ram").textContent = `${freeMem} GB`;

        let sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = config?.java_config?.java_memory ? {
            ramMin: config.java_config.java_memory.min,
            ramMax: config.java_config.java_memory.max
        } : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            config.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData('configClient', config);
            ram = { ramMin: "1", ramMax: "2" };
        }

        this.ramValues = ram;
    }

    async initSlider() {
        let ram = this.ramValues || { ramMin: "1", ramMax: "2" };

        let minSpan = document.querySelector(".slider-touch-left span");
        let maxSpan = document.querySelector(".slider-touch-right span");

        minSpan.setAttribute("value", `${ram.ramMin} GB`);
        maxSpan.setAttribute("value", `${ram.ramMax} GB`);

        let slider = new Slider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));

        slider.on("change", async (min, max) => {
            let config = await this.db.readData('configClient');
            minSpan.setAttribute("value", `${min} GB`);
            maxSpan.setAttribute("value", `${max} GB`);
            config.java_config.java_memory = { min: min, max: max };
            this.db.updateData('configClient', config);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt")
        javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

        let configClient = await this.db.readData('configClient')
        let javaPath = configClient?.java_config?.java_path || 'Utilizar la versión de Java incluida con el lanzador';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document.querySelector(".java-path-set").addEventListener("click", async () => {
            javaPathInputFile.value = '';
            javaPathInputFile.click();
            await new Promise((resolve) => {
                let interval;
                interval = setInterval(() => {
                    if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                }, 100);
            });

            if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                let configClient = await this.db.readData('configClient')
                let file = javaPathInputFile.files[0].path;
                javaPathInputTxt.value = file;
                configClient.java_config.java_path = file
                await this.db.updateData('configClient', configClient);
            } else alert("El nombre del archivo debe ser java o javaw");
        });

        document.querySelector(".java-path-reset").addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            javaPathInputTxt.value = 'Utilizar la versión de Java incluida con el lanzador';
            configClient.java_config.java_path = null
            await this.db.updateData('configClient', configClient);
        });
    }

    async resolution() {
        let configClient = await this.db.readData('configClient')
        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', configClient);
        })

        height.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', configClient);
        })

        resolutionReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854';
            height.value = '480';
            await this.db.updateData('configClient', configClient);
        })
    }

    async launcher() {
        let configClient = await this.db.readData('configClient');

        let maxDownloadFiles = configClient?.launcher_config?.download_multi || 5;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        maxDownloadFilesInput.value = maxDownloadFiles;

        maxDownloadFilesInput.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.launcher_config.download_multi = maxDownloadFilesInput.value;
            await this.db.updateData('configClient', configClient);
        })

        maxDownloadFilesReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            maxDownloadFilesInput.value = 5
            configClient.launcher_config.download_multi = 5;
            await this.db.updateData('configClient', configClient);
        })

        let themeBox = document.querySelector(".theme-box");
        let theme = configClient?.launcher_config?.theme || "auto";

        if (theme == "auto") {
            document.querySelector('.theme-btn-auto').classList.add('active-theme');
        } else if (theme == "dark") {
            document.querySelector('.theme-btn-sombre').classList.add('active-theme');
        } else if (theme == "light") {
            document.querySelector('.theme-btn-clair').classList.add('active-theme');
        }

        themeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('theme-btn')) {
                let activeTheme = document.querySelector('.active-theme');
                if (e.target.classList.contains('active-theme')) return
                activeTheme?.classList.remove('active-theme');

                if (e.target.classList.contains('theme-btn-auto')) {
                    setBackground();
                    theme = "auto";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-sombre')) {
                    setBackground(true);
                    theme = "dark";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-clair')) {
                    setBackground(false);
                    theme = "light";
                    e.target.classList.add('active-theme');
                }

                let configClient = await this.db.readData('configClient')
                configClient.launcher_config.theme = theme;
                await this.db.updateData('configClient', configClient);
            }
        })

        let closeBox = document.querySelector(".close-box");
        let closeLauncher = configClient?.launcher_config?.closeLauncher || "close-launcher";

        if (closeLauncher == "close-launcher") {
            document.querySelector('.close-launcher').classList.add('active-close');
        } else if (closeLauncher == "close-all") {
            document.querySelector('.close-all').classList.add('active-close');
        } else if (closeLauncher == "close-none") {
            document.querySelector('.close-none').classList.add('active-close');
        }

        closeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('close-btn')) {
                let activeClose = document.querySelector('.active-close');
                if (e.target.classList.contains('active-close')) return
                activeClose?.classList.toggle('active-close');

                let configClient = await this.db.readData('configClient')

                if (e.target.classList.contains('close-launcher')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-launcher";
                    await this.db.updateData('configClient', configClient);
                } else if (e.target.classList.contains('close-all')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-all";
                    await this.db.updateData('configClient', configClient);
                } else if (e.target.classList.contains('close-none')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-none";
                    await this.db.updateData('configClient', configClient);
                }
            }
        })
    }

    /**
     * storage() — Bloque de almacenamiento en pestaña LAUNCHER (v1.1)
     *
     * Muestra:
     *   · Ruta fija de instancias (%appdata%/.MetalDaze) — solo lectura
     *   · Botón "Abrir" que abre la carpeta en el explorador nativo
     *   · Tamaño usado por la carpeta de instancias
     *   · Espacio libre y total del disco donde está instalada
     *   · Barra visual de uso del disco
     *
     * Requiere en main.js (proceso principal) los handlers IPC:
     *   ipcMain.handle('storage-get-instances-path', ...)
     *   ipcMain.handle('storage-get-info', ...)
     *   ipcMain.on('storage-open-folder', ...)
     *   (ver comentario al final de este método)
     */
    async storage() {
        const pathEl      = document.getElementById('storage-path')
        const sizeEl      = document.getElementById('storage-instances-size')
        const freeEl      = document.getElementById('storage-disk-free')
        const totalEl     = document.getElementById('storage-disk-total')
        const barFill     = document.getElementById('storage-bar-fill')
        const barPct      = document.getElementById('storage-bar-pct')
        const openBtn     = document.getElementById('storage-open-btn')

        // ── 1. Obtener ruta de instancias del proceso principal ──────────
        // El main process resuelve %appdata%/.MetalDaze y lo devuelve.
        let instancesPath = ''
        try {
            instancesPath = await ipcRenderer.invoke('storage-get-instances-path')
            pathEl.value = instancesPath
        } catch (err) {
            pathEl.value = 'No se pudo obtener la ruta'
            console.error('[storage] storage-get-instances-path error:', err)
        }

        // ── 2. Abrir carpeta al pulsar el botón ──────────────────────────
        openBtn.addEventListener('click', () => {
            if (instancesPath) ipcRenderer.send('storage-open-folder', instancesPath)
        })

        // ── 3. Obtener info de disco y tamaño de carpeta ─────────────────
        try {
            const info = await ipcRenderer.invoke('storage-get-info', instancesPath)
            // info = { instancesSize: bytes, diskFree: bytes, diskTotal: bytes }

            sizeEl.textContent  = this.formatBytes(info.instancesSize)
            freeEl.textContent  = this.formatBytes(info.diskFree)
            totalEl.textContent = this.formatBytes(info.diskTotal)

            // Barra: porcentaje de uso del disco (excluyendo libre)
            const used = info.diskTotal - info.diskFree
            const pct  = info.diskTotal > 0 ? Math.round((used / info.diskTotal) * 100) : 0

            barFill.style.width = `${pct}%`
            barPct.textContent  = `${pct}%`

            // Color según umbral
            barFill.classList.remove('storage-bar-warn', 'storage-bar-crit')
            if (pct >= 90)      barFill.classList.add('storage-bar-crit')
            else if (pct >= 70) barFill.classList.add('storage-bar-warn')

        } catch (err) {
            sizeEl.textContent  = 'Error'
            freeEl.textContent  = 'Error'
            totalEl.textContent = 'Error'
            console.error('[storage] storage-get-info error:', err)
        }
    }

    /**
     * Convierte bytes a string legible: KB, MB, GB
     */
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B'
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
    }
}
export default Settings;

/*
 * ════════════════════════════════════════════════════════════
 * HANDLERS IPC NECESARIOS EN main.js (proceso principal)
 * Pegar en el archivo main.js de Electron
 * ════════════════════════════════════════════════════════════
 *
 * const { app, ipcMain, shell } = require('electron')
 * const path  = require('path')
 * const fs    = require('fs')
 * const os    = require('os')
 *
 * // ── Ruta fija de instancias ──────────────────────────────
 * const INSTANCES_PATH = path.join(
 *     os.homedir(), 'AppData', 'Roaming', '.MetalDaze'
 * )
 * // En macOS/Linux sería:
 * // const INSTANCES_PATH = path.join(os.homedir(), '.MetalDaze')
 *
 * // Devuelve la ruta al renderer
 * ipcMain.handle('storage-get-instances-path', () => INSTANCES_PATH)
 *
 * // Abre la carpeta en el explorador nativo
 * ipcMain.on('storage-open-folder', (event, folderPath) => {
 *     shell.openPath(folderPath)
 * })
 *
 * // Devuelve tamaño de carpeta + info de disco
 * ipcMain.handle('storage-get-info', async (event, folderPath) => {
 *     // Tamaño recursivo de la carpeta de instancias
 *     function getFolderSize(dirPath) {
 *         let total = 0
 *         try {
 *             const entries = fs.readdirSync(dirPath, { withFileTypes: true })
 *             for (const entry of entries) {
 *                 const full = path.join(dirPath, entry.name)
 *                 if (entry.isDirectory()) {
 *                     total += getFolderSize(full)
 *                 } else {
 *                     try { total += fs.statSync(full).size } catch {}
 *                 }
 *             }
 *         } catch {}
 *         return total
 *     }
 *
 *     // Espacio en disco usando statvfs nativo vía módulo 'fs' de Node >=18
 *     // (para versiones anteriores usar el paquete 'check-disk-space')
 *     let diskFree = 0, diskTotal = 0
 *     try {
 *         const stat = await fs.promises.statfs(folderPath)
 *         diskFree  = stat.bfree  * stat.bsize
 *         diskTotal = stat.blocks * stat.bsize
 *     } catch {
 *         // Fallback para Node < 18 o Windows: instala check-disk-space
 *         // const checkDiskSpace = require('check-disk-space').default
 *         // const space = await checkDiskSpace(folderPath)
 *         // diskFree  = space.free
 *         // diskTotal = space.size
 *     }
 *
 *     return {
 *         instancesSize: getFolderSize(folderPath),
 *         diskFree,
 *         diskTotal
 *     }
 * })
 */
