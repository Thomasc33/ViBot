const cheerio = require('cheerio')
const request = require('request')
const pem = require('pem');
require('./extensions.js');
const { EmbedBuilder } = require('discord.js');
const { config: { openSslLocation } } = require('./settings');

if (openSslLocation) pem.config({ pathOpenSSL: openSslLocation });

const agents = [{
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:86.0) Gecko/20100101 Firefox/86.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en',
    'Connection': 'keep-alive',
    'Cookie': 'gdprCookiePolicyAccepted=true; n=1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
}, {
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Accept-Language': 'en-US,en',
    'Cookie': 'closedAlertVersion=8; n=1; gdprCookiePolicyAccepted=true'
}];
const nextAgent = () => agents[(agents.length * Math.random()) ^ 0];

class ProxyURL {
    constructor(user, pass, ip, port, handler, cert) {
        this.user = user;
        this.pass = pass;
        this.ip = ip;
        this.port = port;
        this.cert = cert || { clientKey: null, certificate: null };
        this.handler = handler;
        this.failed = 0;
    }

    get url() {
        return `http://${this.user}:${this.pass}@${this.ip}:${this.port}`;
    }

    async confirm() {
        return new Promise(async (res, rej) => {
            request({ ...(await this.handler.getOptions()), url: 'https://realmeye.com' }, (err, resp, html) => {
                if (err) rej(err);
                if (html) res(true)
                else res(false)
            })
        })
    }

    get key() {
        return this.cert.clientKey;
    }

    get certificate() {
        return this.cert.certificate;
    }
}

class ProxyHandler {
    constructor() {
        this.api = 'https://proxy.webshare.io/api/proxy/list/';
        this.user = 'chdtomqf';
        this.pass = '8w42fa6cv265';
        this.proxyList = [];
        this.position = 0;
    }

    get authorization() {
        return 'Token vb48pl53t7ifrcrzc0dnpklddl7h50n3ndjrvt7d';
    }

    async updateProxyList() {
        await new Promise((res, rej) => {
            const options = {
                url: this.api,
                headers: { 'Authorization': this.authorization, 'X-Webshare-SubUser': '32647' }
            }

            request(options, async (err, resp, html) => {
                if (!html) return rej(err);
                let body = JSON.parse(html);
                if (!body?.results) return res();
                this.proxyList = [];
                // changing this since openssl opens itself 100 times on most restarts, rendering the server useless for a couple minutes
                let cert = await this.getCert();
                for (let i of body.results) {
                    this.proxyList.push(new ProxyURL(this.user, this.pass, i.proxy_address, i.ports.http, this, cert));
                }
                res();
            })
        });
    }

    async next(noConfirm) {
        if (!this.proxyList.length)
            await this.updateProxyList();

        this.position++;
        if (this.position >= this.proxyList.length)
            this.position = 0;

        let proxy = this.proxyList[this.position];

        while (!noConfirm && this.proxyList.length && !await proxy.confirm()) {
            if (++proxy.failed >= 3)
                this.proxyList.splice(this.position, 1);
            else
                this.position++;

            if (this.proxyList.length == 0)
                return null;

            if (this.position >= this.proxyList.length)
                this.position = 0;

            proxy = this.proxyList[this.position];
        }

        return proxy;
    }

    async getCert() {
        return new Promise((res) => {
            pem.createCertificate({ days: 1, selfSigned: true }, (err, key) => {
                if (err) {
                    // console.log(err);
                    return res();
                }

                res(key);
            })
        })
    }

    async getOptions(noProxy, noCert) {
        const options = {
            headers: nextAgent(),
            rejectUnauthorized: false
        };
        if (!noProxy) {
            const proxy = await this.next(true);
            if (proxy) {
                options.proxy = proxy.url;
                if (!noCert) {
                    options.key = proxy.key;
                    options.cert = proxy.certificate;
                }
            }
        }
        return options;
    }

    async query(url) {
        return new Promise(async (resolve, reject) => {
            if (typeof url == 'string')
                url = { url }

            const options = { ...(await this.getOptions()), ...url };
            try {
                request(options, (err, response, html) => {
                    if (err) reject(err);
                    resolve({ response, html });
                })
            } catch (e) {
                console.log(e, options.proxy);
                reject(e);
            }
        })
    }
}

const handler = new ProxyHandler();
handler.updateProxyList();

module.exports = {
    //getProxies,
    //proxySwap,
    //checkProxy,
    //getOptions,
    handler,
    //get proxy() { return proxy; },
    //get proxies() { return [...proxies] },

    request(url) {
        return handler.query(url);
    },
    async getUserGroupInfo(igns) {
        igns = [...igns];
        let results = {};
        for (const ign of igns) {
            if (!ign || ign.trim() == '') continue;
            try {
                results[ign] = await this.getUserInfo(ign)
            } catch (e) {
                results[ign] = e;
            }
        }
        return results;
    },
    getUserInfo(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            const search = ign;
            handler.query({ url: `https://www.realmeye.com/player/${ign}` }).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getUserInfo(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }

                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found from search ' + search)

                //summary
                let rows = $(".summary").find("tr")
                for (var i = 0; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        var title = $(row).children("td:nth-child(1)").text();
                        var text = $(row).children("td:nth-child(2)").text();
                        switch (title) {
                            case 'Characters':
                                var chars = text
                            case 'Skins':
                                var skins = text.split(/ +/)[0];
                            case 'Fame':
                                var fame = text.split(/ +/)[0];
                            case 'Exp':
                                var exp = text.split(/ +/)[0];
                            case 'Rank':
                                var rank = text.split(/ +/)[0];
                            case 'Account Fame':
                                var acc_fame = text.split(/ +/)[0];
                            case 'Guild':
                                var guild = text;
                            case 'Guild Rank':
                                var gRank = text;
                            case 'Created':
                                var created = text;
                            case 'First seen':
                                var created = text
                            case 'Last seen':
                                var lastSeen = text;
                            default:
                                continue;
                        }
                    } catch (er) { continue }
                }
                let desc = [$('.line1.description-line').text(), $('.line2.description-line').text(), $('.line3.description-line').text()]
                let characters = []
                rows = $('.table.table-striped.tablesorter > tbody').find('tr')

                // list of all items
                let items = $('span .item')
                
                // list of all character stats
                let charStats = $("span.player-stats")

                for (var i = 0; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        let idx = 2;
                        const test = $(row).children('td:nth-child(2)').children()[0];
                        if (test && test.name === 'a')
                            idx++;

                        // each weapon span starts at an index thats modulo 4
                        let itemStartIndex = i * 4
                        let weapon = $(items[itemStartIndex]).attr('title')
                        let ability = $(items[itemStartIndex + 1]).attr('title')
                        let armor = $(items[itemStartIndex + 2]).attr('title')
                        let ring = $(items[itemStartIndex + 3]).attr('title')

                        characters.push({
                            class: $(row).children(`td:nth-child(${idx})`).text(),
                            level: $(row).children(`td:nth-child(${idx + 1})`).text(),
                            fame: $(row).children(`td:nth-child(${idx + 3})`).text().replace(/[^0-9]/g, ''),
                            weapon: weapon,
                            ability: ability,
                            armor: armor,
                            ring: ring,
                            stats: $(charStats[i]).text(),
                            statsTotal: $(charStats[i]).attr('data-stats'),
                            statsBonus: $(charStats[i]).attr('data-bonuses')
                        })
                    } catch (er) { continue }
                }
                let userInfo = {
                    ign: ign,
                    chars: chars,
                    skins: skins,
                    fame: fame,
                    exp: exp,
                    rank: rank,
                    acc_fame: acc_fame,
                    guild: guild,
                    gRank: gRank,
                    created: created,
                    lastSeen: lastSeen,
                    desc: desc,
                    characters: characters
                }
                resolve(userInfo)
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getUserInfo(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }

            });
        })
    },
    getGraveyardSummary(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            handler.query(`https://www.realmeye.com/graveyard-summary-of-player/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getGraveyardSummary(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }
                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found')
                try {
                    //summary
                    let chars, skins, fame, exp, rank, acc_fame, guild, gRank, created, lastSeen
                    let rows = $(".summary").find("tr")
                    for (var i = 0; i < rows.length; i++) {
                        try {
                            let row = rows[i]
                            var title = $(row).children("td:nth-child(1)").text();
                            var text = $(row).children("td:nth-child(2)").text();
                            switch (title) {
                                case 'Characters':
                                    chars = text
                                case 'Skins':
                                    skins = text.split(/ +/)[0];
                                case 'Fame':
                                    fame = text.split(/ +/)[0];
                                case 'Exp':
                                    exp = text.split(/ +/)[0];
                                case 'Rank':
                                    rank = text.split(/ +/)[0];
                                case 'Account Fame':
                                    acc_fame = text.split(/ +/)[0];
                                case 'Guild':
                                    guild = text;
                                case 'Guild Rank':
                                    gRank = text;
                                case 'Created':
                                    created = text;
                                case 'First seen':
                                    created = text
                                case 'Last seen':
                                    lastSeen = text;
                                default:
                                    continue;
                            }
                        } catch (er) { continue }
                    }
                    let desc = [$('.line1.description-line').text(), $('.line2.description-line').text(), $('.line3.description-line').text()]

                    //death totals
                    let deathRows
                    try { deathRows = $("table.table-striped.tablesorter.maxed-stats-by-class").find('tfoot').find('tr')[0].children } catch (er) { return reject(`Unloaded Graveyard`) }
                    if (!deathRows) return reject(`Unloaded Graveyard`)
                    let deaths = []
                    for (var i = 1; i < deathRows.length; i++) deaths.push(deathRows[i].children[0].data)

                    let achievements = []
                    let achievementrows = $(".table.table-striped.other-achievements").find("tr")
                    if (!achievementrows) return reject(`Unloaded Graveyard`)
                    for (var i = 1; i < achievementrows.length; i++) {
                        try {
                            let row = achievementrows[i]
                            achievements.push({
                                type: $(row).children('td:nth-child(1)').text().replace(/[0-9]/g, ''),
                                total: $(row).children('td:nth-child(2)').text().replace(/[^0-9%ydhm]/g, ''),
                                max: $(row).children('td:nth-child(3)').text().replace(/[^0-9%ydhm]/g, ''),
                                average: $(row).children('td:nth-child(4)').text().replace(/[^0-9.%ydhm]/g, ''),
                                min: $(row).children('td:nth-child(5)').text().replace(/[^0-9%ydhm]/g, ''),
                            })
                        } catch (er) { continue }
                    }

                    //dungeon completes
                    let dungeonCompletes = []
                    let dungeonrows = $(".table.table-striped.main-achievements").find("tr")
                    if (!dungeonrows) return reject(`Unloaded Graveyard`)
                    for (var i = 1; i < dungeonrows.length; i++) {
                        try {
                            let row = dungeonrows[i]
                            dungeonCompletes.push({
                                type: $(row).children('td:nth-child(2)').text().replace(/[0-9]/g, ''),
                                total: $(row).children('td:nth-child(3)').text().replace(/[^0-9]/g, ''),
                                max: $(row).children('td:nth-child(4)').text().replace(/[^0-9]/g, ''),
                                average: $(row).children('td:nth-child(5)').text().replace(/[^0-9.]/g, ''),
                                min: $(row).children('td:nth-child(6)').text().replace(/[^0-9]/g, ''),
                            })
                        } catch (er) { continue }
                    }

                    //gather and return
                    let userInfo = {
                        ign: ign,
                        chars: chars,
                        skins: skins,
                        fame: fame,
                        exp: exp,
                        rank: rank,
                        acc_fame: acc_fame,
                        guild: guild,
                        gRank: gRank,
                        created: created,
                        lastSeen: lastSeen,
                        desc: desc,
                        deaths: deaths,
                        dungeonCompletes: dungeonCompletes,
                        achievements: achievements
                    }
                    resolve(userInfo)
                } catch (er) {
                    return reject(`${ign} Graveyard Privated Info`)
                }
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getGraveyardSummary(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }

            });
        })
    },
    getNameHistory(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            handler.query(`https://www.realmeye.com/name-history-of-player/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getNameHistory(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }

                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found')
                //summary
                try {

                    let pastNames = []
                    try {
                        let table = $('th.header').filter(function () { return $(this).text().trim() === 'Class' }).first().parent().parent().siblings('tbody').toArray();
                        //let table = $("#f > tbody").toArray()
                        if (table && table.length > 0)
                            for (let i of table) {
                                try {
                                    pastNames.push($(i).children('td:nth-child(0)').text().replace(/[0-9]/g, ''))
                                } catch (er) { continue; }
                            }
                        else pastNames.push(ign)
                    } catch (er) { return reject('Hidden name history') }

                    let userInfo = {
                        ign: ign,
                        pastNames: pastNames
                    }
                    resolve(userInfo)
                } catch (er) {
                    return reject(`${ign} Name Privated Info`)
                }
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getNameHistory(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }

            });
        })
    },
    getFameHistory(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            handler.query(`https://www.realmeye.com/fame-history-of-player/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getFameHistory(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }
                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found')
                //summary
                try {

                    let type = -1
                    let oneDay = []
                    let oneWeek = []
                    let lifeTime = []
                    let scripts = $('script').toArray()

                    for (let i of scripts) {
                        if (i.attribs.src) continue
                        if (!i.children[0] || !i.children[0].data || !i.children[0].data.includes('initializeGraphs')) continue
                        let data = i.children[0].data.substring(i.children[0].data.indexOf('initializeGraphs') + 18, i.children[0].data.indexOf(',"f");') - 1)
                        data.split('],[').forEach(e => {
                            if (e.charAt(0) == '[') type++;
                            let num = parseInt(e.split(',')[1].replace(/[^0-9]/gi, ''))
                            if (type == 0) oneDay.push(num)
                            else if (type == 1) oneWeek.push(num)
                            else if (type == 2) lifeTime.push(num)
                        })
                    }

                    let userInfo = {
                        ign: ign,
                        oneDay: oneDay,
                        oneWeek: oneWeek,
                        lifeTime: lifeTime
                    }
                    resolve(userInfo)
                } catch (er) {
                    return reject(`${ign} Fame Privated Info`)
                }
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getFameHistory(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }

            });
        })
    },
    getExaltationHistory(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            const search = ign;
            handler.query(`https://www.realmeye.com/exaltations-of/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getExaltationHistory(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }
                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found')

                //summary
                let rows = $(".summary").find("tr")
                for (var i = 0; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        var title = $(row).children("td:nth-child(1)").text();
                        var text = $(row).children("td:nth-child(2)").text();
                        switch (title) {
                            case 'Characters':
                                var chars = text
                            case 'Skins':
                                var skins = text.split(/ +/)[0];
                            case 'Fame':
                                var fame = text.split(/ +/)[0];
                            case 'Exp':
                                var exp = text.split(/ +/)[0];
                            case 'Rank':
                                var rank = text.split(/ +/)[0];
                            case 'Account Fame':
                                var acc_fame = text.split(/ +/)[0];
                            case 'Guild':
                                var guild = text;
                            case 'Guild Rank':
                                var gRank = text;
                            case 'Created':
                                var created = text;
                            case 'First seen':
                                var created = text
                            case 'Last seen':
                                var lastSeen = text;
                            default:
                                continue;
                        }
                    } catch (er) { continue }
                }
                let desc = [$('.line1.description-line').text(), $('.line2.description-line').text(), $('.line3.description-line').text()]
                let characters = {}
                rows = $('.table.table-striped.tablesorter > tbody').find('tr')
                for (var i = 0; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        let char = $(row).children(`td:nth-child(2)`).text()
                        characters[char] = {
                            total: $(row).children(`td:nth-child(3)`).text(),
                            health: $(row).children(`td:nth-child(4)`).text(),
                            mana: $(row).children(`td:nth-child(5)`).text(),
                            attack: $(row).children(`td:nth-child(6)`).text(),
                            defense: $(row).children(`td:nth-child(7)`).text(),
                            speed: $(row).children(`td:nth-child(8)`).text(),
                            dexterity: $(row).children(`td:nth-child(9)`).text(),
                            vitality: $(row).children(`td:nth-child(10)`).text()
                        }
                    } catch (er) { continue }
                }
                let userInfo = {
                    ign: ign,
                    chars: chars,
                    skins: skins,
                    fame: fame,
                    exp: exp,
                    rank: rank,
                    acc_fame: acc_fame,
                    guild: guild,
                    gRank: gRank,
                    created: created,
                    lastSeen: lastSeen,
                    desc: desc,
                    exaltations: characters
                }
                resolve(userInfo)
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getExaltationHistory(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }
            });
        })
    },
    getPetInfo(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            handler.query(`https://www.realmeye.com/pets-of/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getPetInfo(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }
                if (!html) return reject({ message: 'No body' })
                const $ = cheerio.load(html);
                //summary
                let pets = []
                rows = $(".table.table-striped.tablesorter").find("tr")
                for (var i = 1; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        pets.push({
                            abilityOne: $(row).children('td:nth-child(6)').text(),
                            abilityOneLevel: $(row).children('td:nth-child(7)').text(),
                            abilityTwo: $(row).children('td:nth-child(8)').text(),
                            abilityTwoLevel: $(row).children('td:nth-child(9)').text(),
                            abilityThree: $(row).children('td:nth-child(10)').text(),
                            abilityThreeLevel: $(row).children('td:nth-child(11)').text(),
                            maxLevel: $(row).children('td:nth-child(12)').text(),
                        })
                    } catch (er) { continue }
                }
                let userInfo = {
                    pets: pets
                }
                resolve(userInfo)
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getPetInfo(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }
            });
        })
    },
    getNames(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            handler.query(`https://www.realmeye.com/name-history-of-player/${ign}`).then(async ({ html }) => {
                if (!html) {
                    if (take2) return reject({ message: 'No body for ' + search });
                    else {
                        let err;
                        const result = await this.getNames(ign, true).catch(er => err = er);
                        if (err)
                            return reject(err);
                        return resolve(result);
                    }
                }
                if (!html) return reject(err);
                const $ = cheerio.load(html);
                const names = [];
                try {
                    const rows = $('div.table-responsive > table > tbody > tr > td:first-child > span').toArray();
                    for (const span of rows)
                        names.push($(span).text());
                    resolve(names);
                } catch (error) {
                    return reject(`${ign} has privated name history: \`\`\`${error}\`\`\``);
                }
            }).catch(async err => {
                if (take2) reject(err);
                else {
                    err = null;
                    const result = await this.getNames(ign, true).catch(er => err = er);
                    if (err)
                        return reject(err);
                    resolve(result);
                }
            });;
        });
    },
    getSancProfile(ign) {
        return new Promise((resolve, reject) => {
            let options = {
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': nextAgent(),
                },
                json: {
                    ign: ign
                }
            };

            request.post(`https://api.losthalls.org/getProfile`, options, (err, res, body) => {
                if (!body.profile)
                    return reject(`No profile found for ${ign}.`);
                resolve(body.profile.oryx3);
            })
        })
    },
    queryLHOrg(ign) {
        return new Promise((resolve, reject) => {
            let options = {
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': nextAgent(),
                },
                json: {
                    ign: ign
                }
            };

            request.post(`https://api.losthalls.org/getProfile`, options, (err, res, body) => {
                if (!body.profile)
                    return reject(`No profile found for ${ign}.`);
                resolve(body.profile);
            })
        })
    },
    async getEmbed(ign, bot) {
        getUserInfo = this.getUserInfo
        return new Promise(async function (resolve, reject) {
            let charInfo = await this.getUserInfo(ign)
                .catch(er => {
                    return reject(er)
                })
            if (!charInfo) return reject('error')
            let embed = new EmbedBuilder()
                .setColor('#0000ff')
                .setTitle(`Character List for ${ign}`)
            for (let i in charInfo.characters) {
                let current = charInfo.characters[i]
                let characterEmote = bot.emojis.cache.find(e => e.name == current.class)
                let weaponEmoji, abilityEmoji, armorEmoji, ringEmoji
                if (!current.weapon) weaponEmoji = 'None'
                else weaponEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.weapon.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.ability) abilityEmoji = 'None'
                else abilityEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ability.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.armor) armorEmoji = 'None'
                else armorEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.armor.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.ring) ringEmoji = 'None'
                else ringEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ring.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                embed.addFields({ name: current.class, value: `${characterEmote} | LVL: \`${current.level}\` | Fame: \`${current.fame}\` | Stats: \`${current.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}` })
            }
            resolve(embed)
        })
    }
}