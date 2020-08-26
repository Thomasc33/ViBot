const cheerio = require('cheerio')
const request = require('request')
const botSettings = require('./settings.json')
module.exports = {
    getUserInfo(ign) {
        return new Promise((resolve, reject) => {
            let options = {
                url: `https://www.realmeye.com/player/${ign}`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36'
                }
            }
            //let req = request.defaults({proxy: `http://${botSettings.proxy.user}:${botSettings.proxy.password}@${botSettings.proxy.host}:${botSettings.proxy.port}`});
            request(options, function (err, resp, html) {
                if (!html) return reject({ message: 'No body' })
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
                rows = $(".table.table-striped.tablesorter").find("tr")
                for (var i = 1; i < rows.length; i++) {
                    try {
                        let row = rows[i]
                        characters.push({
                            class: $(row).children('td:nth-child(3)').text(),
                            level: $(row).children('td:nth-child(4)').text(),
                            fame: $(row).children('td:nth-child(6)').text().replace(/[^0-9]/g, ''),
                            weapon: $(row).children('td:nth-child(9)').children('span:nth-child(1)').children('a').children('span').attr('title'),
                            ability: $(row).children('td:nth-child(9)').children('span:nth-child(2)').children('a').children('span').attr('title'),
                            armor: $(row).children('td:nth-child(9)').children('span:nth-child(3)').children('a').children('span').attr('title'),
                            ring: $(row).children('td:nth-child(9)').children('span:nth-child(4)').children('a').children('span').attr('title'),
                            stats: $(row).children('td:nth-child(10)').text(),
                            statsTotal: $(row).children('td:nth-child(10)').children('span').attr('data-stats'),
                            statsBonus: $(row).children('td:nth-child(10)').children('span').attr('data-bonuses')
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
    getGraveyardSummary(ign) {
        return new Promise((resolve, reject) => {
            let options = {
                url: `https://www.realmeye.com/graveyard-summary-of-player/${ign}`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36'
                }
            }
            request(options, function (err, resp, html) {
                if (!html) return reject('No Body')
                const $ = cheerio.load(html);
                var ign = $('.col-md-12').find("h1").text()
                if (ign == '') return reject('User not found')
                //summary
                try {
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
                    let deathRows
                    try { deathRows = $("table.table-striped.tablesorter.maxed-stats-by-class").find('tfoot').find('tr')[0].children }
                    catch (er) { return reject(`Unloaded Graveyard`) }
                    if (!deathRows) return reject(`Unloaded Graveyard`)
                    let deaths = []
                    for (var i = 1; i < deathRows.length; i++) deaths.push(deathRows[i].children[0].data)
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
                        achievements: dungeonCompletes
                    }
                    resolve(userInfo)
                } catch (er) {
                    return reject(`Privated Info`)
                }
            })
        })
    }

}