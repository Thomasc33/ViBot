const axios = require('axios')
const creds = require('../settings.json').dynamicDomainCredentials
const adminUsers = ['277636691227836419', '258286481167220738']

module.exports = {
    name: 'updateip',
    role: 'developer',
    async execute(message, args, bot) {
        if (!adminUsers.includes(message.author.id)) return message.channel.send('you are missing perms')
        let res = await axios.get(`https://${creds.username}:${creds.password}@domains.google.com/nic/update?hostname=a.vibot.tech`)
        if (res.status == 200) return message.react('✅')
        else return message.channel.send(`Status code: \`${res.status}\`\nStatus Text: \`${res.statusText}\``)
    }
}