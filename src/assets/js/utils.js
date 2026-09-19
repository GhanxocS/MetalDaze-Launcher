/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 * Modificado por ITakerMetal
 */

const { ipcRenderer } = require('electron')
const { Status } = require('minecraft-java-core')
const fs = require('fs');
const pkg = require('../package.json');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';
import { t, applyTranslations } from './utils/i18n.js';

function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto"
        theme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
    }
    let background
    let body = document.body;
    // Reasigna solo dark/light/global — preserva 'high-contrast' si estaba
    // prendido (className = '...' completo lo borraría de otra forma).
    let keepHighContrast = body.classList.contains('high-contrast');
    body.className = theme ? 'dark global' : 'light global';
    if (keepHighContrast) body.classList.add('high-contrast');
    if (fs.existsSync(`${__dirname}/assets/images/background/easterEgg`) && Math.random() < 0.005) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/easterEgg`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `url(./assets/images/background/easterEgg/${Background})`;
    } else if (fs.existsSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`)) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${theme ? 'dark' : 'light'}/${Background})`;
    }
    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

/**
 * Sistema de acento del launcher — reemplaza el teal→violeta fijo de
 * theme.css por un color elegible: presets tipo TwooVerse + custom (hex).
 * Se persiste en configClient.launcher_config.accent_color.
 */

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb({ h, s, l }) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
}

function lightenHex(hex, amount) {
    const hsl = rgbToHsl(hexToRgb(hex));
    hsl.l = Math.min(0.88, hsl.l + amount);
    return rgbToHex(hslToRgb(hsl));
}

// id: clave persistida en config. a/b: los dos stops del gradiente de marca
// (a = frío/claro, b = cálido/dominante — el que se usa como ink-pairing,
// glow y selección, igual que Ion Violet en el sistema original).
const ACCENT_PRESETS = {
    metaldaze: { name: 'MetalDaze', a: '#2dd4bf', b: '#7c5cff' },
    reactor: { name: 'Reactor', a: '#67e8f9', b: '#22d3ee' },
    cobalto: { name: 'Cobalto', a: '#60a5fa', b: '#3b82f6' },
    esmeralda: { name: 'Esmeralda', a: '#6ee7b7', b: '#10b981' },
    rosa: { name: 'Rosa', a: '#f9a8d4', b: '#ec4899' },
    ambar: { name: 'Ámbar', a: '#fcd34d', b: '#f59e0b' },
};

function isHex(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Aplica un preset (por id) o un color custom (hex) como acento de todo
 * el launcher. Sin argumento: relee el último guardado (o el default) y
 * lo vuelve a aplicar — usado al arrancar la app, junto a setBackground().
 * Con argumento: aplica en vivo y persiste la elección.
 */
async function setAccent(value) {
    let databaseLauncher = new database();
    let configClient = await databaseLauncher.readData('configClient');
    let stored = configClient?.launcher_config?.accent_color || 'metaldaze';
    let target = value !== undefined ? value : stored;

    let a, b;
    if (ACCENT_PRESETS[target]) {
        a = ACCENT_PRESETS[target].a;
        b = ACCENT_PRESETS[target].b;
    } else if (isHex(target)) {
        b = target;
        a = lightenHex(target, 0.18);
    } else {
        target = 'metaldaze';
        a = ACCENT_PRESETS.metaldaze.a;
        b = ACCENT_PRESETS.metaldaze.b;
    }

    const rgbB = hexToRgb(b);
    // Ink oscura por defecto (igual que el sistema original); si el acento
    // elegido es oscuro (poco probable con estos presets, posible con un
    // custom raro) se usa ink clara para no perder contraste.
    const ink = rgbToHsl(rgbB).l < 0.5 ? '#f2f3f7' : '#17111f';

    const root = document.body.style;
    root.setProperty('--accent-a', a);
    root.setProperty('--accent-b', b);
    root.setProperty('--accent-glow', `rgba(${rgbB.r}, ${rgbB.g}, ${rgbB.b}, 0.35)`);
    root.setProperty('--md-accent', b);
    root.setProperty('--md-accent-strong', a);
    root.setProperty('--md-accent-ink', ink);
    root.setProperty('--md-accent-wash-faint', `rgba(${rgbB.r}, ${rgbB.g}, ${rgbB.b}, 0.05)`);
    root.setProperty('--md-accent-wash', `rgba(${rgbB.r}, ${rgbB.g}, ${rgbB.b}, 0.12)`);
    root.setProperty('--md-accent-wash-strong', `rgba(${rgbB.r}, ${rgbB.g}, ${rgbB.b}, 0.2)`);
    root.setProperty('--md-accent-glow', `rgba(${rgbB.r}, ${rgbB.g}, ${rgbB.b}, 0.35)`);

    if (value !== undefined && configClient) {
        configClient.launcher_config.accent_color = target;
        await databaseLauncher.updateData('configClient', configClient);
    }

    return { id: target, a, b };
}

/**
 * Tamaño de texto — escala el font-size raíz (<html>). A propósito NO
 * usamos el zoom real de Electron acá: ese reescala toda la ventana
 * renderizada (layout, íconos, imágenes) y Settings está construido con
 * posicionamiento fijo en píxeles (sidebar, offsets absolutos) que no
 * está pensado para convivir con zoom — rompía la interfaz. Escalar
 * solo el font-size raíz mueve el texto y el espaciado en rem sin
 * tocar esa estructura fija, así que no puede desalinear nada.
 * factor: 0.9–1.3 (100% = normal, 16px).
 */
async function setTextScale(factor) {
    let databaseLauncher = new database();
    let configClient = await databaseLauncher.readData('configClient');
    let target = factor !== undefined ? factor : (configClient?.launcher_config?.text_scale || 1);

    document.documentElement.style.fontSize = `${target * 100}%`;

    if (factor !== undefined && configClient) {
        configClient.launcher_config.text_scale = target;
        await databaseLauncher.updateData('configClient', configClient);
    }
    return target;
}

/**
 * Alto contraste — clase global que theme.css usa para subir el
 * contraste de texto apagado y bordes en todo el launcher, no solo
 * Ajustes. Sin argumento: relee configClient y la reaplica.
 */
async function setHighContrast(enabled) {
    let databaseLauncher = new database();
    let configClient = await databaseLauncher.readData('configClient');
    let target = enabled !== undefined ? enabled : !!configClient?.launcher_config?.high_contrast;

    document.body.classList.toggle('high-contrast', target);

    if (enabled !== undefined && configClient) {
        configClient.launcher_config.high_contrast = target;
        await databaseLauncher.updateData('configClient', configClient);
    }
    return target;
}

/**
 * Idioma — por ahora solo guarda la preferencia. IMPORTANTE: no hay
 * sistema de traducción implementado todavía, así que elegir "English"
 * no cambia los textos de la interfaz (siguen en español). Queda listo
 * para conectar un i18n real más adelante sin tocar este selector.
 */
async function setLanguage(lang) {
    let databaseLauncher = new database();
    let configClient = await databaseLauncher.readData('configClient');
    let target = lang !== undefined ? lang : (configClient?.launcher_config?.language || 'es');

    applyTranslations(target);

    if (lang !== undefined && configClient) {
        configClient.launcher_config.language = target;
        await databaseLauncher.updateData('configClient', configClient);
    }
    return target;
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    if (!panel) {
        console.error(`[changePanel] El panel ".${id}" no existe, se ignora el cambio.`);
        return;
    }
    let active = document.querySelector(`.active`)
    if (active) active.classList.toggle("active");
    panel.classList.add("active");
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path)
}

async function addAccount(data) {
    if (document.getElementById(data.ID)) return;

    let skin = false;
    if (data?.profile?.skins[0]?.base64) skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${escapeHtml(data.name)}</div>
            <div class="profile-uuid">${escapeHtml(data.uuid)}</div>
        </div>
        <div class="delete-profile" data-id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `
    let accountsList = document.querySelector('.accounts-list');
    if (!accountsList) return;
    let el = accountsList.appendChild(div);
    updateAccountsCount();
    return el;
}

// Cuenta total de perfiles guardados (excluye el botón "add") — solo
// pisa el badge de la pestaña Cuentas si existe en el DOM (no-op en
// cualquier otro panel).
function updateAccountsCount() {
    let countEl = document.getElementById('accounts-count');
    if (!countEl) return;
    let accountsList = document.querySelector('.accounts-list');
    let count = accountsList ? accountsList.querySelectorAll('.account:not(#add)').length : 0;
    countEl.textContent = count;
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select')

    if (activeAccount) activeAccount.classList.toggle('account-select');
    if (!account) return;
    account.classList.add('account-select');
    if (data?.profile?.skins[0]?.base64) {
        headplayer(data.profile.skins[0].base64);
        await recordSkinHistory(data);
    }

    // Barra grande de "cuenta activa" en Ajustes > Cuentas — no-op si esa
    // pestaña no está en el DOM (cualquier otro panel).
    let heroName = document.getElementById('account-hero-name');
    if (heroName) {
        heroName.textContent = data.name;
        document.getElementById('account-hero')?.classList.add('account-hero-active');
        let heroAvatar = document.getElementById('account-hero-avatar');
        if (heroAvatar) {
            if (data?.profile?.skins[0]?.base64) {
                let heroSkin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
                heroAvatar.style.backgroundImage = `url(${heroSkin})`;
            } else {
                heroAvatar.style.backgroundImage = '';
            }
        }
    }
}

// Guarda una entrada en el historial de skins (pestaña Skins de Home) cada
// vez que una cuenta pasa a ser la activa — login, cambio de cuenta, o
// refresh de token al arrancar. Deduplicado contra la última entrada de esa
// misma cuenta: sin esto, cada reinicio del launcher con el mismo skin
// agregaría una fila idéntica al historial.
async function recordSkinHistory(data) {
    const base64 = data?.profile?.skins?.[0]?.base64;
    if (!base64 || !data?.uuid) return;

    const db = new database();
    let history = await db.readAllData('skinHistory');
    const accountEntries = history.filter(h => h.uuid === data.uuid);
    const last = accountEntries[accountEntries.length - 1];
    if (last && last.base64 === base64) return;

    await db.createData('skinHistory', {
        uuid: data.uuid,
        name: data.name,
        base64,
        capturedAt: Date.now(),
    });

    // Recorte del historial completo (todas las cuentas juntas) a las
    // últimas 24 entradas — el store no debe crecer sin límite.
    history = await db.readAllData('skinHistory');
    const MAX_HISTORY = 24;
    if (history.length > MAX_HISTORY) {
        const overflow = history.slice().sort((a, b) => a.capturedAt - b.capturedAt).slice(0, history.length - MAX_HISTORY);
        for (const entry of overflow) await db.deleteData('skinHistory', entry.ID);
    }
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage = `url(${skin})`;
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name')
    let statusServerElement = document.querySelector('.server-status-text')
    let playersOnline = document.querySelector('.status-player-count .player-count')

    if (!statusServerElement) return  // ← elemento eliminado, ignorar
    if (!nameServerElement) return
    if (!playersOnline) return

    if (!opt) {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
        return
    }

    let { ip, port, nameServer } = opt
    nameServerElement.innerHTML = nameServer
    let status = new Status(ip, port);
    let statusServer = await status.getStatus().then(res => res).catch(err => err);

    if (!statusServer.error) {
        statusServerElement.classList.remove('red')
        document.querySelector('.status-player-count').classList.remove('red')
        statusServerElement.innerHTML = `En ligne - ${statusServer.ms ? statusServer.ms : 0} ms`
        playersOnline.innerHTML = statusServer.playersConnect ? statusServer.playersConnect : '0'
    } else {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
    }
}


export {
    t as t,
    applyTranslations as applyTranslations,
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    setAccent as setAccent,
    ACCENT_PRESETS as ACCENT_PRESETS,
    isHex as isHex,
    setTextScale as setTextScale,
    setHighContrast as setHighContrast,
    setLanguage as setLanguage,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    updateAccountsCount as updateAccountsCount,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus,
    escapeHtml as escapeHtml
}