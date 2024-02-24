const axios = require('axios')
const { config: { dynamicDomainCredentials } } = require('../lib/settings');
module.exports = {
    name: 'updateip',
    role: 'developer',
    async execute(message, args, bot) {
        if (!bot.adminUsers.includes(message.author.id)) return message.channel.send('you are missing perms')
        let res = await axios.get(`https://${dynamicDomainCredentials.username}:${dynamicDomainCredentials.password}@domains.google.com/nic/update?hostname=a.vibot.tech`)
        if (res.status == 200) return message.react('✅')
        else return message.channel.send(`Status code: \`${res.status}\`\nStatus Text: \`${res.statusText}\``)
    }
}