/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { ipcRenderer, shell } = require('electron');
const pkg = require('../package.json');
const os = require('os');
import { config, database } from './utils.js';
const nodeFetch = require("node-fetch");


class Splash {
    constructor() {
        this.splash = document.querySelector(".splash");
        this.splashMessage = document.querySelector(".splash-message");
        this.splashAuthor = document.querySelector(".splash-author");
        this.message = document.querySelector(".message");
        this.progress = document.querySelector(".progress");
        document.addEventListener('DOMContentLoaded', async () => {
            let databaseLauncher = new database();
            let configClient = await databaseLauncher.readData('configClient');
            let theme = configClient?.launcher_config?.theme || "auto"
            let isDarkTheme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
            document.body.className = isDarkTheme ? 'dark global' : 'light global';
            if (process.platform == 'win32') ipcRenderer.send('update-window-progress-load')
            this.startAnimation()
        });
    }

    async startAnimation() {
        let splashes = [
            { "message": "Bienvenido a MetalDaze.", "author": "ITakerMetal" },
            { "message": "El forge está caliente.", "author": "ITakerMetal" },
            { "message": "Cargando mundos...", "author": "MetalDaze Estudio" },
            { "message": "Construido con dedicación.", "author": "MetalDaze Estudio" },
            { "message": "El metal nunca muere.", "author": "ITakerMetal" },
            { "message": "Preparando la aventura...", "author": "MetalDaze Estudio" }
        ];
        let splash = splashes[Math.floor(Math.random() * splashes.length)];
        this.splashMessage.textContent = splash.message;
        this.splashAuthor.children[0].textContent = "@" + splash.author;
        await sleep(100);
        document.querySelector("#splash").style.display = "block";
        document.body.classList.add("ready");
        await sleep(50);
        // Activa animación de entrada del frame (scale + opacity definida en CSS)
        document.querySelector(".splash-frame").classList.add("visible");
        await sleep(400);
        // Anima el logo (translateY + opacity definida en CSS)
        document.querySelector(".splash-logo-wrap").classList.add("show");
        await sleep(500);
        this.splashMessage.classList.add("opacity");
        this.splashAuthor.classList.add("opacity");
        this.message.classList.add("opacity");
        await sleep(1000);
        this.checkUpdate();
    }

    async checkUpdate() {
        this.setStatus(`Buscando actualizaciones...`);

        ipcRenderer.invoke('update-app').then().catch(err => {
            console.error('Error al buscar actualizaciones:', err);
            return this.maintenanceCheck();
        });

        ipcRenderer.on('updateAvailable', () => {
            this.setStatus(`¡Hay una actualización disponible! Descargando...`);
            if (os.platform() == 'win32') {
                this.toggleProgress();
                ipcRenderer.send('start-update');
            } else {
                return this.dowloadUpdate();
            }
        })

        ipcRenderer.on('error', (event, err) => {
            console.error('Error de actualizacion:', err);
            return this.maintenanceCheck();
        })

        ipcRenderer.on('download-progress', (event, progress) => {
            ipcRenderer.send('update-window-progress', { progress: progress.transferred, size: progress.total })
            this.setProgress(progress.transferred, progress.total);
        })

        ipcRenderer.on('update-not-available', () => {
            console.log("El launcher está actualizado.");
            this.maintenanceCheck();
        })
    }

    getLatestReleaseForOS(os, preferredFormat, asset) {
        return asset.filter(asset => {
            const name = asset.name.toLowerCase();
            const isOSMatch = name.includes(os);
            const isFormatMatch = name.endsWith(preferredFormat);
            return isOSMatch && isFormatMatch;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    }

    async dowloadUpdate() {
        const repoURL = pkg.repository.url.replace("git+", "").replace(".git", "").replace("https://github.com/", "").split("/");
        const githubAPI = await nodeFetch('https://api.github.com').then(res => res.json()).catch(err => err);

        const githubAPIRepoURL = githubAPI.repository_url.replace("{owner}", repoURL[0]).replace("{repo}", repoURL[1]);
        const githubAPIRepo = await nodeFetch(githubAPIRepoURL).then(res => res.json()).catch(err => err);

        const releases_url = await nodeFetch(githubAPIRepo.releases_url.replace("{/id}", '')).then(res => res.json()).catch(err => err);
        const latestRelease = releases_url[0].assets;
        let latest;

        if (os.platform() == 'darwin') latest = this.getLatestReleaseForOS('mac', '.dmg', latestRelease);
        else if (os.platform() == 'linux') latest = this.getLatestReleaseForOS('linux', '.appimage', latestRelease);

        this.setStatus(`¡Actualización disponible!<br><div class="download-update">Descargar</div>`);
        document.querySelector(".download-update").addEventListener("click", () => {
            shell.openExternal(latest.browser_download_url);
            return this.shutdown("Descargando actualización...");
        });
    }

    async maintenanceCheck() {
        config.GetConfig().then(res => {
            if (res.maintenance) return this.shutdown(res.maintenance_message);
            this.startLauncher();
        }).catch(e => {
            console.error(e);
            return this.shutdown("No se ha detectado ninguna conexión a Internet,<br>inténtalo de nuevo más tarde.");
        })
    }

    startLauncher() {
        this.setStatus(`Iniciando MetalDaze Launcher...`);
        ipcRenderer.send('main-window-open');
        ipcRenderer.send('update-window-close');
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Se cerrará en 5 segundos`);
        let i = 4;
        setInterval(() => {
            this.setStatus(`${text}<br>Cerrando en ${i--}s`);
            if (i < 0) ipcRenderer.send('update-window-close');
        }, 1000);
    }

    setStatus(text) {
        this.message.innerHTML = text;
    }

    toggleProgress() {
        if (this.progress.classList.toggle("show")) this.setProgress(0, 1);
    }

    setProgress(value, max) {
        this.progress.value = value;
        this.progress.max = max;
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
        ipcRenderer.send("update-window-dev-tools");
    }
})
new Splash();
