const axios = require('axios')
const creds = require('../settings.json').dynamicDomainCredentials

module.exports = {
    name: 'updateip',
    role: 'developer',
    async execute(message, args, bot) {
        if (!bot.adminUsers.includes(message.author.id)) return message.channel.send('you are missing perms')
        const res = await axios.get(`https://${creds.username}:${creds.password}@domains.google.com/nic/update?hostname=a.vibot.tech`)
        if (res.status == 200) return message.react('✅')
        return message.channel.send(`Status code: \`${res.status}\`\nStatus Text: \`${res.statusText}\``)
    }
}
