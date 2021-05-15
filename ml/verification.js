const tf = require('@tensorflow/tfjs-node')
const fs = require('fs')
const mainAccountData = require('../data/maindata.json')
const altAccountData = require('../data/altdata.json')
const botSettings = require('../settings.json')
const realmEyeScrape = require('../lib/realmEyeScrape')

function normalize(value, min, max) {
    if ((!min && min !== 0) || (!max && max !== 0)) return value;
    if (value > max) return 1;
    if (value < min) return 0;
    return (value - min) / (max - min)
}

//rank
const RANK_MIN = 0;
const RANK_MAX = 80;
//alive fame
const FAME_MIN = 0;
const FAME_MAX = 291600;
//deaths
const DEATH_MIN = 0;
const DEATH_MAX = 3987;
//account created
const AGE_MIN = 0;
const AGE_MAX = 3384;
//character count
const CHAR_MIN = 0;
const CHAR_MAX = 16;
//skins
const SKIN_MIN = 0;
const SKIN_MAX = 176;
//deaths
const DEATH_MAXES = [3246, 102, 40, 53, 38, 60, 135, 52, 3987]
//dungeons
const DUNGEON_TOTAL_MAX = [
    790911, 1788886, 436, 1160301, 3487820,
    110976, 932620303, 149, 2348, 681,
    779, 1115, 684, 1749, 595,
    437, 594, 1044, 401, 3349,
    320, 324, 405, 174, 769,
    709, 810, 1688, 534, 320,
    1002, 96, 72, 1226, 1610,
    915, 1971, 6274, 1047, 182,
    7982, 9455, 5532, 381, 1465,
    168, 333, 528, 166, 750
]
const DUNGEON_MAX_MAX = [
    151441, 503088, 51, 66168, 304778,
    7868, 88188699, 78, 802, 552,
    403, 419, 122, 293, 322,
    198, 154, 850, 401, 978,
    111, 108, 44, 69, 306,
    311, 362, 546, 206, 166,
    206, 32, 29, 132, 401,
    117, 226, 1084, 208, 59,
    658, 1395, 1001, 68, 242,
    83, 95, 38, 100, 543
]
const DUNGEON_AVERAGE_MAX = [
    24206, 87626, 8, 6670, 63156,
    1500, 21004730, 7, 45, 22,
    56, 81, 12, 86, 10,
    6, 8, 8, 9, 70,
    4, 9, 1, 1, 15,
    11, 20, 27, 43, 8,
    74, 7, 2, 8, 14,
    34, 13, 138, 26, 12,
    106, 76, 41, 3, 11,
    2, 6, 5, 2, 14
]
const DUNGEON_MIN_MAX = [
    24206, 87626, 8, 6670, 63156,
    1500, 21004730, 2, 20, 22,
    1, 81, 12, 86, 3,
    1, 2, 3, 0, 18,
    1, 1, 0, 0, 10,
    6, 4, 12, 4, 0,
    14, 2, 1, 5, 3,
    4, 12, 138, 26, 12,
    106, 76, 25, 2, 11,
    2, 1, 2, 1, 13
]
const dungeonIndexes = {
    'Base fame': 0,
    'Total fame': 1,
    'Oryx kills': 2,
    'God kills': 3,
    'Monster kills': 4,
    'Quests completed': 5,
    'Tiles uncovered': 6,
    'Lost Halls completed': 7,
    'Voids completed': 8,
    'Cultist Hideouts completed': 9,
    'Nests completed': 10,
    'Shatters completed': 11,
    'Tombs completed': 12,
    'Ocean Trenches completed': 13,
    'Parasite chambers completed': 14,
    'Lairs of Shaitan completed': 15,
    "Puppet Master's Encores completed": 16,
    'Cnidarian Reefs completed': 17,
    'Secluded Thickets completed': 18,
    'Cursed Libraries completed': 19,
    'Fungal Caverns completed': 20,
    'Crystal Caverns completed': 21,
    'Lairs of Draconis (hard mode) completed': 22,
    'Lairs of Draconis (easy mode) completed': 23,
    'Mountain Temples completed': 24,
    'Crawling Depths completed': 25,
    'Woodland Labyrinths completed': 26,
    'Deadwater Docks completed': 27,
    'Ice Caves completed': 28,
    'Bella Donnas completed': 29,
    "Davy Jones's Lockers completed": 30,
    'Battle for the Nexuses completed': 31,
    'Candyland Hunting Grounds completed': 32,
    "Puppet Master's Theatres completed": 33,
    'Toxic Sewers completed': 34,
    'Haunted Cemeteries completed': 35,
    'Mad Labs completed': 36,
    'Abysses of Demons completed': 37,
    'Manors of the Immortals completed': 38,
    'Ancient Ruins completed': 39,
    'Undead Lairs completed': 40,
    'Sprite Worlds completed': 41,
    'Snake Pits completed': 42,
    'Caves of a Thousand Treasures completed': 43,
    'Magic Woods completed': 44,
    'Hives completed': 45,
    'Spider Dens completed': 46,
    'Forbidden Jungles completed': 47,
    'Forest Mazes completed': 48,
    'Pirate Caves completed': 49
}
//achievements
const ACHIEVEMENT_TOTAL_MAX = [
    3833987, 4322267,
    69829429, 36532274,
    1883695, 341712,
    41270, 27464,
    38236, 278,
    997975, 17169
]
const ACHIEVEMENT_MAX_MAX = [
    951206, 503097,
    13867295, 10454289,
    509438, 56044,
    5211, 6140,
    8234, 59,
    432127, 31946667
]
const ACHIEVEMENT_AVERAGE_MAX = [
    55862, 195051, 4878946,
    2192954, 23083, 2919,
    401, 998, 298,
    59, 71187, 4677
]
const ACHIEVEMENT_MIN_MAX = [
    8197, 195051, 4878946,
    2192954, 14307, 2919,
    303, 998, 298,
    59, 71187, 10759
]
const achievementIndexes = {
    'God kill assists': 0,
    'Monster kill assists': 1,
    'Shots': 2,
    'Hits': 3,
    'Ability uses': 4,
    'Teleports': 5,
    'Potions drunk': 6,
    'Cube kills': 7,
    'Level up assists': 8,
    'Active for': 9,
    'Fame bonuses': 10,
    'Accuracy': 11
}

var xs2D = [], ys2D = []
for (let i in altAccountData) {
    let data = arrayFromUserInfo(altAccountData[i])
    if (!data) continue
    xs2D.push(data)
    ys2D.push([1])
}
for (let i in mainAccountData) {
    let data = arrayFromUserInfo(mainAccountData[i])
    if (!data) continue
    xs2D.push(data)
    ys2D.push([0])
}

const xs = tf.tensor2d(xs2D)
const ys = tf.tensor2d(ys2D)

var model

if (fs.existsSync(`${botSettings.vibotDirectory}/verificationModel/model.json`)) {
    async function loadModel() {
        model = await tf.loadLayersModel(`file://${botSettings.vibotDirectory}/verificationModel/model.json`)

        //compile
        model.compile({
            optimizer: tf.train.adam(),
            loss: tf.losses.meanSquaredError
        })
    }
    loadModel().then(train)
}
else {
    //set model
    model = tf.sequential();
    let layer = 'softplus'
    //input layer
    model.add(tf.layers.dense({
        units: 270,
        inputShape: [270],
        activation: layer
    }))

    //hidden layers
    model.add(tf.layers.dense({
        units: 750,
        activation: layer
    }))
    model.add(tf.layers.dense({
        units: 75,
        activation: layer
    }))
    model.add(tf.layers.dense({
        units: 20,
        activation: layer
    }))

    //output layer
    model.add(tf.layers.dense({
        units: 1,
        activation: layer
    }))

    //compile
    model.compile({
        optimizer: tf.train.adam(0.0001),
        loss: tf.losses.huberLoss
    })

    train().then(async () => { console.log('training complete') })
}



async function train() {
    if (botSettings.MLtraining) {
        const config = {
            shuffle: true,
            epochs: 15,
            verbose: 1,
            validationSplit: 0.2,
            shuffle: true,
        }
        const response = await model.fit(xs, ys, config)
        console.log(response.history.loss[0])
    }
}

/**
 * 
 * @param {Object} userInfo
 */
async function altDetection(userInfo) {
    return new Promise(async (res, rej) => {
        let data = arrayFromUserInfo(userInfo)
        if (!data) res(null)
        //predict
        let prediction = model.predict(tf.tensor2d([data])).dataSync()
        return res(prediction[0] * 100)
    })
}

/**
 * 
 * @param {Object} userInfo 
 * @param {Number} verified 
 * @param {Number} Epochs
 * @returns 
 */
async function trainNewData(userInfo, verified, epochs = 3) {
    return new Promise(async (res, rej) => {
        if (!botSettings.MLActiveTraining) return res(NaN)
        let data = arrayFromUserInfo(userInfo)
        if (!data) rej('missing data')
        //train
        const config = {
            shuffle: true,
            epochs: epochs,
            verbose: 0
        }
        const response = await model.fit(tf.tensor2d([data]), tf.tensor2d([[verified]]), config)
        res(response.history.loss[0])
    })
}

function arrayFromUserInfo(userInfo) {
    let i = userInfo

    //normalize data
    let res = []

    //user info
    let rank = normalize(parseInt(i.rank), RANK_MIN, RANK_MAX)
    let fame = normalize(parseInt(i.fame), FAME_MIN, FAME_MAX)
    let age = normalize(i.accountAge, AGE_MIN, AGE_MAX)
    let char = normalize(parseInt(i.characters), CHAR_MIN, CHAR_MAX)
    let skin = normalize(parseInt(i.skins), SKIN_MIN, SKIN_MAX)

    if ((!rank && rank !== 0) || (!fame && fame !== 0) || (!age && age !== 0) || (!char && char !== 0) || (!skin && skin !== 0)) return null
    res = res.concat([rank, fame, age, char, skin])

    //fame history
    let od, ow, lt
    let oneDay = i.oneDay, oneWeek = i.oneWeek, lifeTime = i.lifeTime
    if (oneDay.length == 1 || oneDay.length == 0) od = 0
    if (oneWeek.length == 1 || oneWeek.length == 0) ow = 0
    if (lifeTime.length == 1 || lifeTime.length == 0) lt = 0
    if (od !== 0) {
        let oneDaySum = 0
        for (let i of oneDay) oneDaySum += i
        let oneDayAverage = oneDaySum / oneDay.length
        od = normalize(oneDayAverage, Math.min(...oneDay), Math.max(...oneDay))
    }
    if (ow !== 0) {
        let oneWeekSum = 0
        for (let i of oneWeek) oneWeekSum += i
        let oneWeekAverage = oneWeekSum / oneWeek.length
        ow = normalize(oneWeekAverage, Math.min(...oneWeek), Math.max(...oneWeek))
    }
    if (lt !== 0) {
        let lifeTimeSum = 0
        for (let i of lifeTime) lifeTimeSum += i
        let lifeTimeAverage = lifeTimeSum / lifeTime.length
        lt = normalize(lifeTimeAverage, Math.min(...lifeTime), Math.max(...lifeTime))
    }

    if ((!od && od !== 0) || (!ow && ow !== 0) || (!lt && lt !== 0)) return null
    res = res.concat([od, ow, lt])

    //deaths totals
    let normalizedDeaths = []
    for (let j in i.deaths) {
        normalizedDeaths.push(normalize(parseInt(i.deaths[j], 0, DEATH_MAXES[j])))
    }
    res = res.concat(normalizedDeaths)
    //dungeon completes
    let dungeonTot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let dungeonMax = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let dungeonAverage = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let dungeonMin = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (let j of i.dungeonCompletes) {
        let arI = dungeonIndexes[j.type]
        if (!arI) continue
        dungeonTot[arI] = normalize(parseInt(j.total), 0, DUNGEON_TOTAL_MAX[arI])
        dungeonMax[arI] = normalize(parseInt(j.max), 0, DUNGEON_MAX_MAX[arI])
        dungeonAverage[arI] = normalize(parseInt(j.average), 0, DUNGEON_AVERAGE_MAX[arI])
        dungeonMin[arI] = normalize(parseInt(j.min), 0, DUNGEON_MIN_MAX[arI])
        if (!dungeonTot[arI]) dungeonTot[arI] = 0
        if (!dungeonMax[arI]) dungeonMax[arI] = 0
        if (!dungeonAverage[arI]) dungeonAverage[arI] = 0
        if (!dungeonMin[arI]) dungeonMin[arI] = 0
    }
    res = res.concat(dungeonTot)
    res = res.concat(dungeonMax)
    res = res.concat(dungeonAverage)
    res = res.concat(dungeonMin)
    //achievements
    let achievementTot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let achievementMax = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let achievementAverage = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let achievementMin = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (let j of i.achievements) {
        let arI = achievementIndexes[j.type]
        if (!arI) continue
        achievementTot[arI] = normalize(parseInt(j.total), 0, ACHIEVEMENT_TOTAL_MAX[arI])
        achievementMax[arI] = normalize(parseInt(j.max), 0, ACHIEVEMENT_MAX_MAX[arI])
        achievementAverage[arI] = normalize(parseInt(j.average), 0, ACHIEVEMENT_AVERAGE_MAX[arI])
        achievementMin[arI] = normalize(parseInt(j.min), 0, ACHIEVEMENT_MIN_MAX[arI])
        if (!achievementTot[arI]) achievementTot[arI] = 0
        if (!achievementMax[arI]) achievementMax[arI] = 0
        if (!achievementAverage[arI]) achievementAverage[arI] = 0
        if (!achievementMin[arI]) achievementMin[arI] = 0
    }
    res = res.concat(achievementTot)
    res = res.concat(achievementMax)
    res = res.concat(achievementAverage)
    res = res.concat(achievementMin)
    //pet
    let petLevel = []
    if (!i.pet) petLevel = [0, 0, 0, 0]
    else {
        petLevel.push(normalize(parseInt(i.pet.abilityOneLevel), 0, 100) | 0)
        petLevel.push(normalize(parseInt(i.pet.abilityTwoLevel), 0, 100) | 0)
        petLevel.push(normalize(parseInt(i.pet.abilityThreeLevel), 0, 100) | 0)
        petLevel.push((getPetTier(i.pet.abilityOne) + getPetTier(i.pet.abilityTwo) + getPetTier(i.pet.abilityThree)) / 3)
    }
    function getPetTier(talent) {
        switch (talent) {
            case 'Heal':
            case 'Magic Heal':
                return 1
            case 'Electric':
            case 'Attack Close':
            case 'Attack Mid':
            case 'Attack Far':
                return .5
            default:
                return 0
        }
    }

    res = res.concat(petLevel)
    return res
}


var saveInterval = setInterval(async () => {
    if (!botSettings.MLActiveTraining && !botSettings.MLtraining) return clearInterval(saveInterval)
    await model.save(`file://${botSettings.vibotDirectory}/verificationModel`).catch(err => { });
}, 60000)

async function RealmeyeFucker(ign) {
    return new Promise(async res => {
        if (!ign) { console.log(ign); res() }
        let errored

        //death/general
        let deathInfo = await realmEyeScrape.getGraveyardSummary(ign).catch(er => { errored = true })
        if (errored) return res()
        let rank = deathInfo.rank
        let fame = deathInfo.fame
        let accountAgeValue = deathInfo.created
        let accountAge
        if (accountAgeValue.includes('year')) {
            accountAge = parseInt(accountAgeValue.replace('~', '').charAt(0)) * 365
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge += days
        } else if (accountAgeValue == '~ a day ago') {
            accountAge = 1
        } else if (accountAgeValue == 'hidden') return res();
        else {
            let days = parseInt(accountAgeValue.substring(1, accountAgeValue.length).replace(/[^0-9]/gi, ''))
            if (days !== NaN && days > 0 && days < 366) accountAge = days
        }
        let characters = deathInfo.chars
        let skins = deathInfo.skins
        if (!rank || !fame || !accountAge || !characters || !skins) {
            return res()
        }

        //fame history
        let fameInfo = await realmEyeScrape.getFameHistory(ign).catch(er => { errored = true })
        if (errored) return res()

        //pet info
        let petInfo = await realmEyeScrape.getPetInfo(ign).catch(er => { errored = true })
        let bestPet = petInfo.pets[0]

        if (errored) return res()

        let data = {
            rank: rank,
            fame: fame,
            accountAge: accountAge,
            characters: characters,
            skins: skins,
            oneDay: fameInfo.oneDay,
            oneWeek: fameInfo.oneWeek,
            lifeTime: fameInfo.lifeTime,
            deaths: deathInfo.deaths,
            dungeonCompletes: deathInfo.dungeonCompletes,
            achievements: deathInfo.achievements,
            pet: bestPet
        }
        res(data)
    })
}

module.exports = {
    altDetection,
    model,
    saveInterval,
    trainNewData,
    RealmeyeFucker
}