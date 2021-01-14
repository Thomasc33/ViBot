const ml = require('../ml/verification')
const realm = require('../lib/realmEyeScrape')

module.exports = {
    name: 'testalt',
    description: 'Checks the percent chance an account is a main account based on machine learning',
    args: '<ign>',
    role: 'security',
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        let errored
        let data = await realm.getGraveyardSummary(args[0]).catch(er => { errored = true })
        if (errored) return message.channel.send('Their graveyard history is privated')

        let accountAgeValue = data.created
        let accountAge
        if (accountAgeValue.includes('year')) {
            accountAge = parseInt(accountAgeValue.replace('~', '').replace('less than ', '').charAt(0)) * 365
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge += days
        } else if (accountAgeValue == '~ a day ago') {
            accountAge = 1
        } else if (accountAgeValue == 'hidden') errored = true
        else {
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge = days
        }
        if (errored) return message.channel.send('There is an issue finding their account age')

        let fameHistoryData = await realm.getFameHistory(args[0]).catch(er => { errored = true })
        if (errored) return message.channel.send('There was an issue getting their fame history')

        let altDetectionScore
        if (accountAge && fameHistoryData.oneDay && fameHistoryData.oneWeek && fameHistoryData.lifeTime) altDetectionScore = await ml.altDetection(data.rank, data.fame, data.deaths[data.deaths.length - 1], accountAge, data.chars, data.skins, fameHistoryData.oneDay, fameHistoryData.oneWeek, fameHistoryData.lifeTime)
        message.channel.send(`Percent Chance \`${args[0]}\` is a main account: %${altDetectionScore * 100}`)
    },
    async trainFromIGN(ign, verified) {
        let errored
        let data = await realm.getGraveyardSummary(ign).catch(er => {
            errored = true
        })
        if (errored) return

        let accountAgeValue = data.created
        let accountAge
        if (accountAgeValue.includes('year')) {
            accountAge = parseInt(accountAgeValue.replace('~', '').replace('less than ', '').charAt(0)) * 365
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge += days
        } else if (accountAgeValue == '~ a day ago') {
            accountAge = 1
        } else if (accountAgeValue == 'hidden') errored = true
        else {
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge = days
        }
        if (errored) return

        let fameHistoryData = await realm.getFameHistory(ign).catch(er => { errored = true })
        if (errored) return

        let altDetectionScore
        if (accountAge && fameHistoryData.oneDay && fameHistoryData.oneWeek && fameHistoryData.lifeTime) altDetectionScore = await ml.trainNewData(data.rank, data.fame, data.deaths[data.deaths.length - 1], accountAge, data.chars, data.skins, fameHistoryData.oneDay, fameHistoryData.oneWeek, fameHistoryData.lifeTime, verified)
    }
}
