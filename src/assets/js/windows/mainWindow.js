/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
}

function createWindow() {
    destroyWindow();
    mainWindow = new BrowserWindow({
        title: app.getName(),
        width: 480,
        height: 650,
        minWidth: 480,
        minHeight: 650,
        resizable: true,
        maximizable: true,
        icon: `./src/assets/images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    // La ventana ahora es resizable/maximizable de verdad (ver app.js), así que
    // el usuario puede maximizarla por vías que no pasan por nuestro botón
    // (doble click en la barra, snap de Windows). Avisamos al renderer del
    // estado real para que el ícono de maximizar/restaurar no se desincronice.
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized-change', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized-change', false));
    // Fuerza el zoom a 100% siempre. Chromium persiste el nivel de zoom por
    // origen en el perfil de la app (userData), así que un valor probado en
    // una sesión anterior (p.ej. mientras existió la extinta "Escala de
    // interfaz") puede quedar pegado y sobrevivir a un simple reinicio del
    // launcher si no se resetea acá explícitamente.
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.on('did-finish-load', () => mainWindow.webContents.setZoomFactor(1));
    // Esta ventana solo carga su propio launcher.html local — nunca necesita
    // navegar a otro lado ni abrir ventanas nuevas (los links externos van
    // por shell.openExternal desde el renderer, no por target=_blank/window.open).
    // Con nodeIntegration:true y sin contextIsolation, dejar pasar una
    // navegación o un window.open le daría a esa página acceso a Node
    // directo — se corta acá antes de que pueda pasar.
    mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.loadFile(path.join(`${app.getAppPath()}/src/launcher.html`));
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: 'detach' })
            mainWindow.show()
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};