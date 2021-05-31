const ml = require('../ml/verification')
const realm = require('../lib/realmEyeScrape')

module.exports = {
    name: 'testalt',
    description: 'Checks the percent chance an account is a main account based on machine learning',
    args: '<ign>',
    role: 'security',
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        let ign = args[0]
        if (ign.toLowerCase() == 'vi') return message.channel.send(`${ign}'s alt percentage is 100%`).then(m => m.react('801965155105374218')) //hardcoded
        let userInfo = await ml.RealmeyeFucker(ign)
        if (!userInfo) return message.channel.send('Realmeye page isnt fully public. Try again')
        let percent = await ml.altDetection(userInfo)
        message.channel.send(`${ign}'s alt percentage is ${percent.toFixed(20)}%`)
    },
    async trainFromIGN(ign, verified) {
        let userInfo = await ml.RealmeyeFucker(ign)
        if (!userInfo) return
        await ml.trainNewData(userInfo, verified)
    },
    async testFromIGN(ign) {
        let userInfo = await ml.RealmeyeFucker(ign)
        if (!userInfo) return null
        let percent = await ml.altDetection(userInfo)
        return percent
    }
}
