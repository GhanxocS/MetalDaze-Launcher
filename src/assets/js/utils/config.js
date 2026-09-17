/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 * Modificado por ITakerMetal
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/config`;
let articles = `${url}/articles`;

// Token opcional de developer: si existe <userData>/dev-token.txt, se manda
// como header x-dev-token al pedir /instances, para que el backend incluya
// las instancias whitelistActive:true (ver server.js). Mismo patrón que
// database.js usa para su key.txt.
async function getDevToken() {
    try {
        const userDataPath = await ipcRenderer.invoke('path-user-data');
        const tokenPath = path.join(userDataPath, 'dev-token.txt');
        if (fs.existsSync(tokenPath)) {
            return fs.readFileSync(tokenPath, 'utf-8').trim();
        }
    } catch (e) {}
    return null;
}

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if (config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        let urlInstance = `${url}/instances`
        let devToken = await getDevToken()
        let fetchOpts = devToken ? { headers: { 'x-dev-token': devToken } } : {}
        let instances = await nodeFetch(urlInstance, fetchOpts).then(res => res.json()).catch(err => err)
        let instancesList = []
        instances = Object.entries(instances)

        for (let [name, data] of instances) {
            let instance = data
            instancesList.push(instance)
        }
        return instancesList
    }

    async getNews(config) {
        if (config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async config => {
                    if (config.status === 200) {
                        let news = [];
                        let response = await config.text()
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            })
                        }
                        return resolve(news);
                    }
                    else return reject({ error: { code: config.statusText, message: 'No se puede acceder al servidor' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(articles).then(async config => {
                    if (config.status === 200) return resolve(config.json());
                    else return reject({ error: { code: config.statusText, message: 'No se puede acceder al servidor' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }
}

export default new Config;