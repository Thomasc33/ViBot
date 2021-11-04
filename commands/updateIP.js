const axios = require('axios')
const creds = require('../settings.json').dynamicDomainCredentials

module.exports = {
    name: 'updateip',
    role: 'developer',
    async execute(message, args, bot) {
        if (!['277636691227836419', '130850662522159104', '298989767369031684'].includes(message.author.id)) return message.channel.send('you are missing perms')
        let res = await axios.get(`https://${creds.username}:${creds.password}@domains.google.com/nic/update?hostname=a.vibot.tech`)
        if (res.status == 200) return message.react('✅')
        else return message.channel.send(`Status code: \`${res.status}\`\nStatus Text: \`${res.statusText}\``)
    }
}