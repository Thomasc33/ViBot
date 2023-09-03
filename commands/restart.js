const fs = require('fs')
const botStatus = require('./botstatus')
const afkCheck = require('./afkCheck.js')
const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    restarting: false,
    allowedInRestart: true,

    async execute(message, args, bot) {
        // Log channel the message was sent to
        const channel = message.channel;
        const d = {
            guild: channel.guild.id,
            channel: channel.id
        }
        // Save channel object to file
        fs.writeFileSync('./data/restart_channel.json', JSON.stringify(d, null, 2));

        if (args[0]?.toLowerCase() == 'force') process.exit()
        
        module.exports.restarting = true;

        new Promise(async (resolve) => {
            /** @type {afkCheck.afkCheck[]} */
            const afks = Object.values(bot.afkModules);
            if (!afks.some(afk => afk.active)) return resolve();
            const fields = {};
            afks.filter(afk => afk.active).forEach(afk => {
                fields[afk.guild?.name] = (fields[afk.guild?.name] || '') + `${afk.raidStatusMessage?.url}\n`
            })
            await channel.send({ embeds: [
                new EmbedBuilder()
                    .setTitle('Restarting')
                    .setDescription('Restart is waiting for the following afks')
                    .setFields(Object.entries(fields).map(([name,value]) => ({ name, value })))
            ]})
            await botStatus.updateStatus(bot, 'Restart Pending', '#ff0000')
            setInterval(() => {
                if (!Object.values(bot.afkModules).some(afk => afk.active)) resolve();
            }, 5000)
        }).then(async () => {
            await channel.send('Bot restarting now, please wait...').catch(() => {});
            process.exit();
        })
    }
}
