const ErrorLogger = require('../logError')

module.exports = {
    name: 'getfeedback',
    description: 'Fetches all mentions of the user in customer feedback',
    args: '<user mention/id>',
    role: 'Raid Leader',
    alias: 'gfb',
    async execute(message, args, bot) {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Raid Leader").position) return;
        var member = message.mentions.members.first()
        if (member == undefined) {
            member = message.guild.members.cache.get(args[0]);
        }
        if (member == undefined) { message.channel.send('User not found'); return; }
        const customerFeedback = message.guild.channels.cache.find(c => c.name === "customer-feedback")
        let findings = await message.channel.send(`Searching for all mentions of ${member} in ${customerFeedback}`)
        var mentions = `Messages found mentioning ${member} in ${customerFeedback}:\n `
        customerFeedback.messages.fetch()
            .then(messages => {
                let mentioning = messages.filter(m => m.mentions.users.get(member.id))
                if (mentioning.length == 0) message.channel.send("No mentions of user found")
                else {
                    mentioning.each(m => mentions = mentions.concat(`\n${m.url}`));
                    findings.edit(mentions)
                }
            })
    }
}