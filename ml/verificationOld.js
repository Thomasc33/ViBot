const tf = require('@tensorflow/tfjs-node')

const TRAIN_DATA_PATH = 'file://C:/Users/Carrt/OneDrive/Desktop/ViBot/verificationData.csv'
const TRAIN_DATA_LENGTH = 6248;
const NUM_VERI_RESULTS = 2;

//testing
const TRAIN_TEST_DATA_PATH = 'file://C:/Users/Carrt/OneDrive/Desktop/ViBot/verificationDataTest.csv'
const TRAIN_TEST_DATA_LENGTH = 3;


function normalize(value, min, max) {
    if (!min || !max) return value;
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



const csvTransform = ({ xs, ys }) => {
    const values = [
        normalize(xs.rank, RANK_MIN, RANK_MAX),
        normalize(xs.fame, FAME_MIN, FAME_MAX),
        normalize(xs.deaths, DEATH_MIN, DEATH_MAX),
        normalize(xs.accountAge, AGE_MIN, AGE_MAX),
        normalize(xs.characters, CHAR_MIN, CHAR_MAX),
        normalize(xs.skins, SKIN_MIN, SKIN_MAX)
    ]
    return { xs: values, ys: ys.verified }
}


const trainingData = tf.data.csv(TRAIN_DATA_PATH, { columnConfigs: { verified: { isLabel: true } } })
    .map(csvTransform)
    .shuffle(TRAIN_DATA_LENGTH)
    .batch(50)

const trainingValidationData = tf.data.csv(TRAIN_DATA_PATH, { columnConfigs: { verified: { isLabel: true } } })
    .map(csvTransform)
    .batch(TRAIN_DATA_LENGTH)

const testValidationData = tf.data.csv(TRAIN_TEST_DATA_PATH, { columnConfigs: { verified: { isLabel: true } } })
    .map(csvTransform)
    .batch(TRAIN_TEST_DATA_LENGTH)



const model = tf.sequential();

model.add(tf.layers.dense({ units: 250, activation: 'relu', inputShape: [6] }))
model.add(tf.layers.dense({ units: 175, activation: 'relu' }))
model.add(tf.layers.dense({ units: 150, activation: 'relu' }))
model.add(tf.layers.dense({ units: 1, activation: 'softmax' }))

model.compile({
    optimizer: 'sgd',
    loss: 'meanSquaredError',
})

train().then(async () => {
    let prediction = await model.predict(tf.tensor2d([
        [50, 1400, 500, 30, 6, 31]
    ]))
    let data = await prediction.data()
    console.log(data)
})
async function train() {
    let history = await model.fitDataset(trainingData, { epochs: 10, shuffle: true })
}

/*
async function evaluate(useTestData) {
    let results = {}
    await trainingValidationData.forEachAsync(v => {
        console.log(v)
        const values = model.predict(v.xs).dataSync();
        const classSize = TRAIN_DATA_LENGTH / NUM_VERI_RESULTS;
        for (let i = 0; i < NUM_VERI_RESULTS; i++) {
            results[resToString(i)] = {
                training: calculateConfidence(i, classSize, values)
            }
        }
    })
    if (useTestData) {
        await testValidationData.forEachAsync(v => {
            const values = model.predict(v.xs).dataSync();
            const classSize = TRAIN_TEST_DATA_LENGTH / NUM_VERI_RESULTS;
            for (let i = 0; i < NUM_VERI_RESULTS; i++) {
                results[resToString(i)] = {
                    training: calculateConfidence(i, classSize, values)
                }
            }
        })
    }
    return results;
}

async function predictSample(sample) {
    console.log(`predicting sample of ${sample}`)
    let result = model.predict(tf.tensor(sample, [1, sample.length])).arraySync()
    console.log(`prediction done: ${result}`)
    let maxValue = 0;
    let predictedResult = -1;
    for (let i = 0; i < NUM_VERI_RESULTS; i++) {
        if (result[0, i] > maxValue) {
            predictedResult = i;
            maxValue = result[0][i]
        }
    }
    return resToString(predictedResult)
}

function calculateConfidence(veriIndex, classSize, values) {
    let index = (veriIndex * classSize * NUM_VERI_RESULTS) + veriIndex
    let total = 0
    for (let i = 0; i < classSize; i++) {
        total += values[i];
        index += NUM_VERI_RESULTS;
    }
    return total / classSize;
}

function resToString(num) {
    switch (num) {
        case 0:
            return 'denied';
        case 1:
            return 'verified';
        default:
            return 'error';
    }
}

*/


module.exports = {
    //evaluate,
    model,
    //resToString,
    //predictSample,
    testValidationData,
    trainingData,
    TRAIN_TEST_DATA_LENGTH
}