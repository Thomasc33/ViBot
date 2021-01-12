const tf = require('@tensorflow/tfjs-node')
const fs = require('fs')
const data = require('../verificationData.json')
const botSettings = require('../settings.json')

function normalize(value, min, max) {
    if (!min || !max) return value;
    if (value > max) return 1;
    if (value < min) return 0;
    return (value - min) / (max - min)
}

//rank
const RANK_MIN = 0;
const RANK_MAX = 80;
//alive fame
const FAME_MIN = 0;
const FAME_MAX = 244781;
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
const SKIN_MAX = 175;

var xs2D = [], ys2D = []
for (let i of data) {
    let rank = normalize(parseInt(i.rank), RANK_MIN, RANK_MAX)
    let fame = normalize(parseInt(i.fame), FAME_MIN, FAME_MAX)
    let deaths = normalize(parseInt(i.deaths), DEATH_MIN, DEATH_MAX)
    let age = normalize(i.accountAge, AGE_MIN, AGE_MAX)
    let char = normalize(parseInt(i.characters), CHAR_MIN, CHAR_MAX)
    let skin = normalize(parseInt(i.skins), SKIN_MIN, SKIN_MAX)
    if (!rank || !fame || !deaths || !age || !char || !skin) continue;
    xs2D.push([rank, fame, deaths, age, char, skin])
    ys2D.push([i.verified])
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

    //input layer
    model.add(tf.layers.dense({
        units: 4,
        inputShape: [6],
        activation: 'sigmoid'
    }))

    //output layer
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }))

    //compile
    model.compile({
        optimizer: tf.train.adam(),
        loss: tf.losses.meanSquaredError
    })

    train().then(async () => {console.log('training complete')})
}



async function train() {
    if (botSettings.MLtraining)
        for (let i = 0; i < 100; i++) {
            const config = {
                shuffle: true,
                epochs: 10,
                verbose: 0
            }
            const response = await model.fit(xs, ys, config)
            console.log(response.history.loss[0])
        }
}

/**
 * 
 * @param {Number} rank 
 * @param {Number} fame 
 * @param {Number} deaths 
 * @param {Number} age 
 * @param {Number} chars 
 * @param {Number} skins 
 */
async function altDetection(rank, fame, deaths, age, chars, skins) {
    return new Promise((res, rej) => {
        //normalize data
        let normalizedRank = normalize(parseInt(rank), RANK_MIN, RANK_MAX)
        let normalizedFame = normalize(parseInt(fame), FAME_MIN, FAME_MAX)
        let normalizedDeaths = normalize(parseInt(deaths), DEATH_MIN, DEATH_MAX)
        let normalizedAge = normalize(parseInt(age), AGE_MIN, AGE_MAX)
        let normalizedChar = normalize(parseInt(chars), CHAR_MIN, CHAR_MAX)
        let normalizedSkin = normalize(parseInt(skins), SKIN_MIN, SKIN_MAX)

        console.log(normalizedRank, normalizedFame, normalizedDeaths, normalizedAge, normalizedChar, normalizedSkin)
        //rej if data is bad
        if ((!normalizedRank && normalizedRank !== 0) || (!normalizedFame && normalizedFame !== 0) || (!normalizedDeaths && normalizedDeaths !== 0) || (!normalizedAge && normalizedAge !== 0) || (!normalizedChar && normalizedChar !== 0) || (!normalizedSkin && normalizedSkin !== 0)) rej('bad data')

        //predict
        let prediction = model.predict(tf.tensor2d([[normalizedRank, normalizedFame, normalizedDeaths, normalizedAge, normalizedChar, normalizedSkin]])).dataSync()
        return res(prediction[0])
    })
}

var saveInterval = setInterval(async () => {
    await model.save(`file://${botSettings.vibotDirectory}/verificationModel`)
}, 60000)

module.exports = {
    altDetection,
    model,
    saveInterval
}