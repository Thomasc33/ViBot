const Discord = require('discord.js')

module.exports = {
    name: 'check',
    role: 'Security',
    description: 'Performs several checks on stuff in the server',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let checkMessage = await message.channel.send('Checking information on the server. This may take a little bit.')
        let checkEmbed = new Discord.MessageEmbed()
            .setTitle('Check Report')
        //temporary keypopper
        checkEmbed.addField('Temporary Key Poppers', 'None!')
        message.guild.members.cache.filter(u => u.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.tempkey)).id).each(m => {
            if (checkEmbed.fields[0].value == None) checkEmbed.fields[0].value = `<@!${m.id}>`
            else checkEmbed.fields[0].value = checkEmbed.fields[0].value.concat(`, <@!${m.id}>`)
        })
        //people with same name
        let dupesArray = []

        let allMembers = message.guild.members.cache.filter(u => u.nickname && (u.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.raider).id) || u.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.events).id))).map(m => m)
        let allNames = message.guild.members.cache.filter(u => u.nickname && (u.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.raider).id) || u.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.events).id))).map(m => m.nickname.toLowerCase().replace(/[^a-z|]/gi, "").split("|"))
        allNames = allNames.flat()
        let uniqueNames = [... new Set(allNames)]
        for (var i in uniqueNames) {
            allNames.splice(allNames.indexOf(uniqueNames[i]), 1)
        }
        allNames = [... new Set(allNames)]
        for (var i in allNames) {
            let dupes = allMembers.filter(m => m.nickname.toLowerCase().replace(/[^a-z|]/gi, "").split("|").includes(allNames[i]))
            dupes = dupes.map(m => dupesArray.push(m.id))
        }
        dupesArray = dupesArray.filter((item, index) => dupesArray.indexOf(item) === index)
        checkEmbed.addField('Duplicate Names', 'None!')
        for (let i in dupesArray) {
            if (checkEmbed.fields[1].value == 'None!') checkEmbed.fields[1].value = `<@!${dupesArray[i]}>`
            else checkEmbed.fields[1].value += `, <@!${dupesArray[i]}>`
        }
        //pending vet verification
        let veriPendingVet = message.guild.channels.cache.find(c => c.name === settings.vetveri)
        checkEmbed.addField('Pending Veteran Verification', 'None!')
        if (!veriPendingVet) checkEmbed.fields[2].value = 'Error finding channel'
        else {
            let messages = await veriPendingVet.messages.fetch({ limit: 100 })
            messages.each(m => {
                if (m.reactions.cache.has('🔑')) {
                    if (checkEmbed.fields[2].value == 'None!') checkEmbed.fields[2].value = `[Module](${m.url})`
                    else checkEmbed.fields[2].value += `, [Module](${m.url})`
                }
            })
        }
        //pending mod mail
        let modMailChannel = message.guild.channels.cache.find(c => c.name === settings.modmailchannel)
        checkEmbed.addField('Pending ModMail', 'None!')
        if (!modMailChannel) checkEmbed.fields[3].value = 'Error finding channel'
        else {
            let messages = await modMailChannel.messages.fetch({ limit: 100 })
            messages.each(m => {
                if (m.reactions.cache.has('🔑')) {
                    if (checkEmbed.fields[3].value == 'None!') checkEmbed.fields[3].value = `[Module](${m.url})`
                    else checkEmbed.fields[3].value += `, [Module](${m.url})`
                }
            })
        }
        //no nicknames
        let nn = []
        let noNickname = message.guild.members.cache.filter(m => m.nickname == null);
        noNickname.each(user => {
            if (user.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.raider).id) || user.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.events).id)) {
                nn.push(user)
            }
        })
        checkEmbed.addField('No Nicknames', 'None!')
        for (let i in nn) {
            if (checkEmbed.fields[4].value == 'None!') checkEmbed.fields[4].value = `${nn[i]}`
            else checkEmbed.fields[4].value += `, ${nn[i]}`
        }
        for (let i in checkEmbed.fields) {
            if (checkEmbed.fields[i].value.length >= 1024) {
                let replacementEmbed = new Discord.MessageEmbed()
                    .setTitle(checkEmbed.fields[i].name)
                    .setDescription(checkEmbed.fields[i].value)
                message.channel.send(replacementEmbed)
                checkEmbed.fields[i].value = 'See Below'
            }
        }
        checkMessage.edit('', checkEmbed)
    }
}