// const ml = require('../ml/verification')
const botSettings = require('../settings.json')

module.exports = {
    name: 'trainmodel',
    description: 'Trains ml model with given information',
    args: '<ign> <(m)ain/(a)lt> <epochs>',
    role: 'developer',
    requiredArgs: 3,
    async execute(message, args, bot, db) {
        if(!botSettings.MLActiveTraining) return message.channel.send('Active Training is disabled')
        let ign = args[0]
        let isMain = args[1].charAt(0) == 'm' ? true : args[1].charAt(0) == 'a' ? false : null
        let epochs = parseInt(args[2])
        if (!epochs) return message.channel.send(`\`${args[3]}\` is an invalid epoch`)
        if (!ign) return message.channel.send(`\`${args[1]}\` is an invalid ign`)
        if (isMain == null) return message.channel.send(`\`${args[2]}\` is an invalid specification. Try (\`m\` or \`a\`)`)
        let userInfo = await ml.RealmeyeFucker(ign)
        if (!userInfo) return message.channel.send(`${ign}'s realmeye page isnt fully public. Try again`)
        message.react('✅')
        let loss = await ml.trainNewData(userInfo, isMain ? 0 : 1, epochs)
        message.channel.send(`Done. New Loss: \`${loss}\``)
    }
}
