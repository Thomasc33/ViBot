const cheerio = require('cheerio')
const request = require('request')
const pem = require('pem');
require('./extensions.js');

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

var proxy
var key
var proxies = []
getProxies().then(v => proxies = v).catch((e) => { console.log(e); proxies = []})

async function getProxies(take2 = false) {
    let p = []
    return new Promise(res => {
        let opt = {
            url: 'https://proxy.webshare.io/api/proxy/list/?page=0&countries=US',
            headers: { 'Authorization': 'Token 9710e00293182b4f18c94175637a08dd02aaac57' }
        }
        request(opt, async (err, resp, html) => {
			if (!html) return
            let body = JSON.parse(html)
            if (!body) {
                if (take2) return rej('proxies not being returned from webshare')
                else {
                    let err
                    let secondTry = await getProxies(true).catch(er => { err = er })
                    if (err) return rej(err)
                    return res(secondTry)
                }
            }
            for (let i of body.results) {
                p.push(`http://${i.username}:${i.password}@${i.proxy_address}:${i.ports.http}`)
            }
            res(p)
        })
    })
}
async function proxySwap() {
    if (!proxies || proxies.length == 0) proxies = await getProxies()
    proxy = proxies.splice(Math.floor(Math.random() * proxies.length), 1)[0];
	
    //check proxy
    let r = await checkProxy().catch(async (e) => {console.log(await getOptions()); console.log(e)});
    if (!r) {
        await getOptions(true)
        await proxySwap()
    }
    else return
}
async function checkProxy() {
    return new Promise(async (res, rej) => {
		let opt = await getOptions()
        opt = 
        {
            url: 'https://realmeye.com',
            ...opt
        };
        request(opt, (err, resp, html) => {
            if (err) rej(err);
            if (html) res(true)
            else res(false)
        })
    })
}
async function getOptions(keyErrored = false) {
    const options = {
        proxy: proxy,
        headers: nextAgent(),
        rejectUnauthorized: false
    };
    if (keyErrored || !key) {
        key = await new Promise((r) => pem.createCertificate({ days: 1, selfSigned: true }, (err, keys) => {
            if (err) return r();
            r(keys);
        }));
        require('https').globalAgent.options.ca = require('ssl-root-cas').create()
    }
    if (key) {
        options.key = key.clientKey;
        options.cert = key.certificate;
    }
    return options;
}

module.exports = {
    getProxies,
    proxySwap,
    checkProxy,
    getOptions,
    get proxy() { return proxy; },
    get proxies() { return [...proxies] },

    request(url) {
        return new Promise(async (res, rej) => {
            let options = await getOptions();
            options.url = url;
            request(options, function (err, resp, html) {
                if (err) return rej(err);
                return res(html);
            })
        })
    },
    async getUserGroupInfo(igns) {
        igns = [...igns];
        const options = await getOptions();
        let results = {};
        for (const ign of igns) {
            if (!ign || ign.trim() == '') continue;
            try {
                results[ign] = await this.getUserInfo(ign, false, options)
            } catch (e) {
                results[ign] = e;
            }
        }
        return results;
    },
    getUserInfo(ign, take2 = false, options = null) {
        return new Promise(async (resolve, reject) => {
            if (!options) {
                options = await getOptions()
            }
            options = {
                url: `https://www.realmeye.com/player/${ign}`,
                ...options
            }
            const search = ign;
            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getUserInfo(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
                }
                if (!html) return reject({ message: 'No body for ' + search })
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
                let characters = []
                rows = $('.table.table-striped.tablesorter > tbody').find('tr')
                for (var i = 0; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        let idx = 2;
                        const test = $(row).children('td:nth-child(2)').children()[0];
                        if (test && test.name === 'a')
                            idx++;
                        characters.push({
                            class: $(row).children(`td:nth-child(${idx})`).text(),
                            level: $(row).children(`td:nth-child(${idx + 1})`).text(),
                            fame: $(row).children(`td:nth-child(${idx + 3})`).text().replace(/[^0-9]/g, ''),
                            weapon: $(row).children(`td:nth-child(${idx + 6})`).children('span:nth-child(1)').children('a').children('span').attr('title'),
                            ability: $(row).children(`td:nth-child(${idx + 6})`).children('span:nth-child(2)').children('a').children('span').attr('title'),
                            armor: $(row).children(`td:nth-child(${idx + 6})`).children('span:nth-child(3)').children('a').children('span').attr('title'),
                            ring: $(row).children(`td:nth-child(${idx + 6})`).children('span:nth-child(4)').children('a').children('span').attr('title'),
                            stats: $(row).children(`td:nth-child(${idx + 7})`).text(),
                            statsTotal: $(row).children(`td:nth-child(${idx + 7})`).children('span').attr('data-stats'),
                            statsBonus: $(row).children(`td:nth-child(${idx + 7})`).children('span').attr('data-bonuses')
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
            })
        })
    },
    getGraveyardSummary(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            let options = await getOptions();
            options.url = `https://www.realmeye.com/graveyard-summary-of-player/${ign}`;

            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getGraveyardSummary(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
                }
                if (!html) return reject('No Body')
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

                    //achievements
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
            })
        })
    },
    getNameHistory(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            let options = await getOptions();
            options.url = `https://www.realmeye.com/name-history-of-player/${ign}`;
            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getNameHistory(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
                }
                if (!html) return reject('No Body')

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
            })
        })
    },
    getFameHistory(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            let options = await getOptions();
            options.url = `https://www.realmeye.com/fame-history-of-player/${ign}`;
            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getFameHistory(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
                }
                if (!html) return reject('No Body')
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
            })
        })
    },
    getPetInfo(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            let options = await getOptions();
            options.url = `https://www.realmeye.com/pets-of/${ign}`;
            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getPetInfo(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
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
            })
        })
    },
    getNames(ign, take2 = false) {
        return new Promise(async (resolve, reject) => {
            let options = await getOptions();
            options.url = `https://www.realmeye.com/name-history-of-player/${ign}`;
            request(options, async function (err, resp, html) {
                if (!html && !take2) {
                    proxySwap()
                    let err
                    let secondTry = await module.exports.getNames(ign, true)
                        .catch(er => { err = er })
                    if (err) return reject({ message: err })
                    return resolve(secondTry)
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
            });
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
    }
}