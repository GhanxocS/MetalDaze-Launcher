/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 * Modificado por ITakerMetal
 */
// import panel
import Login from './panels/login.js';
import Home from './panels/home.js';
import Settings from './panels/settings.js';

// import modules
import { logger, config, changePanel, database, popup, setBackground, setAccent, setTextScale, setHighContrast, setLanguage, accountSelect, addAccount, pkg } from './utils.js';
const { AZauth, Microsoft, Mojang } = require('minecraft-java-core');

// libs
const { ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');

class Launcher {
    async init() {
        this.initLog();
        console.log('Initializing Launcher...');
        this.shortcut()
        await setBackground()
        await setAccent()
        await setTextScale()
        await setHighContrast()
        this.initFrame();
        this.config = await config.GetConfig().then(res => res).catch(err => err);
        if (await this.config.error) return this.errorConnect()
        this.db = new database();
        await this.initConfigClient();
        this.createPanels(Login, Home, Settings);
        // Después de createPanels(): recién ahí el HTML de los paneles
        // (con sus [data-i18n]) está en el DOM — aplicar antes no traduce nada.
        await setLanguage();
        this.startLauncher();
    }

    initLog() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
                ipcRenderer.send('main-window-dev-tools-close');
                ipcRenderer.send('main-window-dev-tools');
            }
        })
        new logger(pkg.name, '#7289da')
    }

    shortcut() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.keyCode == 87) {
                ipcRenderer.send('main-window-close');
            }
        })
    }


    errorConnect() {
        new popup().openPopup({
            title: this.config.error.code,
            content: this.config.error.message,
            color: 'red',
            exit: true,
            options: true
        });
    }

    initFrame() {
        console.log('Initializing Frame...')
        const isDarwin = os.platform() === 'darwin'
        // Nota: no usar una clase en <body> para esto — utils.js:setBackground()
        // reasigna body.className por completo (theme claro/oscuro/auto) y se
        // llevaría puesta cualquier clase de plataforma que hubiéramos agregado ahí.
        document.querySelector('.darwin-frame').style.display = isDarwin ? 'flex' : 'none'
        document.querySelector('.win-frame').style.display = isDarwin ? 'none' : 'flex'
        const prefix = isDarwin ? 'mac' : 'win'

        document.getElementById(`${prefix}-minimize`).addEventListener('click', () => {
            ipcRenderer.send('main-window-minimize');
        });

        // El ícono de maximizar/restaurar sigue el estado real de la ventana
        // (evento del main process), no un contador local: la ventana ahora se
        // puede maximizar por vías que no pasan por este botón (doble click en
        // la barra, snap de Windows), y un contador local se desincroniza ahí.
        let maximize = document.getElementById(`${prefix}-maximize`);
        maximize.addEventListener('click', () => {
            ipcRenderer.send('main-window-maximize')
        });
        ipcRenderer.on('window-maximized-change', (event, isMaximized) => {
            maximize.classList.toggle('icon-maximize', !isMaximized)
            maximize.classList.toggle('icon-restore-down', isMaximized)
        });

        document.getElementById(`${prefix}-close`).addEventListener('click', () => {
            ipcRenderer.send('main-window-close');
        })
    }

    async initConfigClient() {
        console.log('Initializing Config Client...')
        let configClient = await this.db.readData('configClient')

        if (!configClient) {
            await this.db.createData('configClient', {
                account_selected: null,
                instance_select: null,
                java_config: {
                    java_path: null,
                    java_memory: {
                        min: 2,
                        max: 4
                    }
                },
                game_config: {
                    screen_size: {
                        width: 854,
                        height: 480
                    }
                },
                launcher_config: {
                    download_multi: 5,
                    theme: 'auto',
                    accent_color: 'metaldaze',
                    language: 'es',
                    text_scale: 1,
                    high_contrast: false,
                    closeLauncher: 'close-launcher',
                    intelEnabledMac: true
                }
            })
        }
    }

    createPanels(...panels) {
        let panelsElem = document.querySelector('.panels')
        for (let panel of panels) {
            console.log(`Initializing ${panel.name} Panel...`);
            let div = document.createElement('div');
            div.classList.add('panel', panel.id)
            div.innerHTML = fs.readFileSync(`${__dirname}/panels/${panel.id}.html`, 'utf8');
            panelsElem.appendChild(div);
            new panel().init(this.config);
        }
    }

    async startLauncher() {
        let accounts = await this.db.readAllData('accounts')
        let configClient = await this.db.readData('configClient')
        let account_selected = configClient ? configClient.account_selected : null
        let popupRefresh = new popup();

        if (accounts?.length) {

            // Solo limpiar las filas de cuentas reales — innerHTML = '' acá
            // borraba también el botón fijo #add (viene en el HTML estático
            // de Settings, no se recrea en ningún lado), dejando el launcher
            // sin forma de agregar una segunda cuenta después de reiniciar.
            const accountsList = document.querySelector('.accounts-list');
            if (accountsList) accountsList.querySelectorAll('.account:not(#add)').forEach(el => el.remove());

            for (let account of accounts) {
                let account_ID = account.ID
                if (account.error) {
                    await this.db.deleteData('accounts', account_ID)
                    continue
                }
                if (account.meta.type === 'Xbox') {
                    
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
                        color: 'var(--color)',
                        background: false
                    });

                    let refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);

                    if (refresh_accounts.error) {
                        await this.db.deleteData('accounts', account_ID)
                        if (account_ID == account_selected) {
                            configClient.account_selected = null
                            await this.db.updateData('configClient', configClient)
                        }
                        console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
                        continue;
                    }

                    refresh_accounts.ID = account_ID
                    await this.db.updateData('accounts', refresh_accounts, account_ID)
                    if (!refresh_accounts.error) await addAccount(refresh_accounts)
                    if (account_ID == account_selected) accountSelect(refresh_accounts)
                }
            
                else if (account.meta.type == 'AZauth') {
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
                        color: 'var(--color)',
                        background: false
                    });
                    let refresh_accounts = await new AZauth(this.config.online).verify(account);

                    if (refresh_accounts.error) {
                        this.db.deleteData('accounts', account_ID)
                        if (account_ID == account_selected) {
                            configClient.account_selected = null
                            this.db.updateData('configClient', configClient)
                        }
                        console.error(`[Account] ${account.name}: ${refresh_accounts.message}`);
                        continue;
                    }

                    refresh_accounts.ID = account_ID
                    this.db.updateData('accounts', refresh_accounts, account_ID)
                    await addAccount(refresh_accounts)
                    if (account_ID == account_selected) accountSelect(refresh_accounts)
                } else if (account.meta.type == 'Mojang') {
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
                        color: 'var(--color)',
                        background: false
                    });
                    if (account.meta.online == false) {
                        let refresh_accounts = await Mojang.login(account.name);

                        refresh_accounts.ID = account_ID
                        await addAccount(refresh_accounts)
                        this.db.updateData('accounts', refresh_accounts, account_ID)
                        if (account_ID == account_selected) accountSelect(refresh_accounts)
                        continue;
                    }

                    let refresh_accounts = await Mojang.refresh(account);

                    if (refresh_accounts.error) {
                        this.db.deleteData('accounts', account_ID)
                        if (account_ID == account_selected) {
                            configClient.account_selected = null
                            this.db.updateData('configClient', configClient)
                        }
                        console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
                        continue;
                    }

                    refresh_accounts.ID = account_ID
                    this.db.updateData('accounts', refresh_accounts, account_ID)
                    await addAccount(refresh_accounts)
                    if (account_ID == account_selected) accountSelect(refresh_accounts)
                } else {
                    console.error(`[Account] ${account.name}: Account Type Not Found`);
                    this.db.deleteData('accounts', account_ID)
                    if (account_ID == account_selected) {
                        configClient.account_selected = null
                        this.db.updateData('configClient', configClient)
                    }
                }
            }

            accounts = await this.db.readAllData('accounts')
            configClient = await this.db.readData('configClient')
            account_selected = configClient ? configClient.account_selected : null

            if (!account_selected) {
                let firstAccount = accounts[0]
                if (firstAccount && firstAccount.ID) {
                    configClient.account_selected = firstAccount.ID
                    await this.db.updateData('configClient', configClient)
                    // accountSelect() espera la cuenta completa (usa
                    // .name/.profile además de .ID) — pasarle solo el ID
                    // (como antes) hacía que quedara con data.ID undefined
                    // y no encontrara el elemento a marcar como activo.
                    accountSelect(firstAccount)
                }
            }

            if (!accounts.length) {
                config.account_selected = null
                await this.db.updateData('configClient', config);
                popupRefresh.closePopup()
                ipcRenderer.send('main-window-login-size');
                return changePanel("login")
            }

            popupRefresh.closePopup()
            ipcRenderer.send('main-window-home-size')
            changePanel("home");
        } else {
            popupRefresh.closePopup()
            ipcRenderer.send('main-window-login-size');
            changePanel('login')
        }
    }
}

new Launcher().init();
