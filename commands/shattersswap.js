const fs = require('fs')
let vetVerification = require('../data/vetVerification.json')

module.exports = {
    name: 'newshattersreleased',
    role: 'moderator',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (settings.backend.tempshattersswap) return message.channel.send('already done')
        settings.backend.tempshattersswap = true

        await message.channel.send('changing db now')
        await db.query('ALTER TABLE users RENAME runs TO oldruns', async (err) => {
            if (err) { message.channel.send('runs -> oldruns failed'); throw err }
            await message.channel.send('runs -> oldruns success')

            await db.query('ALTER TABLE users RENAME successruns TO oldsuccessruns', async (err) => {
                if (err) { message.channel.send('successruns -> oldsuccessruns failed'); throw err }
                await message.channel.send('successruns -> oldsuccessruns success')

                await db.query('ALTER TABLE users ADD runs INT DEFAULT 0', async (err) => {
                    if (err) { message.channel.send('new \'runs\' column creation failed'); throw err }
                    await message.channel.send('new \'runs\' column creation success')

                    await db.query('ALTER TABLE users ADD successruns INT DEFAULT 0', async (err) => {
                        if (err) { message.channel.send('new \'successruns\' column creation failed'); throw err }
                        await message.channel.send('new \'successruns\' column creation success')

                    })
                })
            })
        })

        await message.channel.send('disabling realmeye check for vet verification')
        vetVerification['451171819672698920'].realmeyestring = null
        await fs.writeFile('./data/vetVerification.json', JSON.stringify(JSON.stringify(vetVerification, null, 4)))
        message.channel.send('realmeye check disabled. <@!277636691227836419> dont forget to push to repo')

    }
}