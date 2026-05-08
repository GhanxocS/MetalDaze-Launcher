/**
 * Discord Rich Presence — MetalDaze Launcher
 */

const DiscordRPC = require('discord-rpc');

const CLIENT_ID = '1501998193662234886';

let rpc = null;
let ready = false;

async function initRPC() {
    console.log('[RPC] Iniciando...');
    try {
        DiscordRPC.register(CLIENT_ID);
        rpc = new DiscordRPC.Client({ transport: 'ipc' });

        rpc.on('ready', function() {
            console.log('[RPC] Conectado a Discord!');
            ready = true;
            setInLauncher();
        });

        rpc.on('error', function(err) {
            console.error('[RPC] Error de conexión:', err);
        });

        console.log('[RPC] Intentando login...');
        await rpc.login({ clientId: CLIENT_ID });
        console.log('[RPC] Login completado');
    } catch (err) {
        console.error('[RPC] Error al iniciar Discord RPC:', err);
    }
}

function setInLauncher() {
    if (!rpc || !ready) return;
    try {
        rpc.setActivity({
            details: 'En el launcher',
            state: 'MetalDaze Estudio',
            startTimestamp: new Date(),
            largeImageKey: 'logo',
            largeImageText: 'MetalDaze Launcher',
            instance: false
        });
    } catch (err) {
        console.error('[RPC] Error al setear actividad:', err);
    }
}

function destroyRPC() {
    if (!rpc) return;
    try {
        rpc.destroy();
        rpc = null;
        ready = false;
    } catch (err) {
        console.error('[RPC] Error al destruir RPC:', err);
    }
}

module.exports = { initRPC, setInLauncher, destroyRPC };
