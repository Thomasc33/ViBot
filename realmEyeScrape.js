const cheerio = require('cheerio')
const request = require('request')
module.exports = {
    getUserInfo(ign) {
        let options = {
            url: `https://www.realmeye.com/player/${ign}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36'
            }
        }
        request(options, function (err, resp, html) {
            const $ = cheerio.load(html);
            var ign = $('.col-md-12').find("h1").text()
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
            console.log(userInfo)
            return userInfo;
        })
    }
}