const moment = require('moment');
const ErrorLogger = require('../lib/logError');
const { ApplicationCommandOptionType, EmbedBuilder, Colors } = require('discord.js');
const { slashArg, slashCommandJSON } = require('../utils');

/**
 * @typedef MuteRow
 * @property {string} id
 * @property {string} guildid
 * @property {boolean} muted
 * @property {string} reason
 * @property {string} modid
 * @property {string} uTime
 * @property {boolean} perma
 */
/**
 * 
 * @param {MuteRow} row 
 * @param {number?} idx 
 */
function muteRowToString(row, idx) {

}

/**
 * @param {import('discord.js').Message | import('discord.js').CommandInteraction} message
 * @param {import('discord.js').Client} bot
 * @param {import('mysql2').Pool} db
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Role} mutedRole
 * @param {EmbedBuilder} embed
 */
async function displayAllMutes(message, bot, db, mutedRole, embed) {
    embed.setTitle(`${bot.user.displayName} Managed Mutes`);
    const members = mutedRole.members.clone();

    const [rows] = await db.promise().query('SELECT * FROM mutes WHERE muted = true AND guildid = ?', [message.guild.id]);

    const mutedTexts = [''];
    for (const row of rows) {
        const duration = row.perma ? '**permanently**' : `ending <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:R>`;
        const userRow = `<@${row.id}> by <@${row.modid}> ${duration}`;
        if (mutedTexts[mutedTexts.length - 1].length + userRow.length + 1 >= 3800) mutedTexts.push('');
        mutedTexts[mutedTexts.length - 1] += `${userRow}\n`;
        members.delete(row.id);
    }

    if (!rows.length) mutedTexts[0] = 'None!';
    for (const text of mutedTexts) {
        embed.setDescription(text);
        await message.channel.send({ embeds: [embed] });
        embed.setTitle(`${bot.user.displayName} Managed Mutes (cont.)`);
    }

    embed.setTitle(`Unmanaged Mutes`);
    mutedTexts.splice(0);
    mutedTexts.push('');

    members.forEach(member => {
        if (mutedTexts[mutedTexts.length - 1].length + `${member}`.length + 1 >= 3800) mutedTexts.push('');
        mutedTexts[mutedTexts.length -1] += `${member}\n`
    })

    if (!members.size) mutedTexts[0] = 'None!';
    for (const text of mutedTexts) {
        embed.setDescription(text);
        await message.channel.send({ embeds: [embed] });
        embed.setTitle(`Unmanaged Mutes (cont.)`);
    }
}

module.exports = {
    name: 'mutes',
    description: 'Shows mutes for the server',
    role: 'security',
    args: [slashArg(ApplicationCommandOptionType.User, 'member', { description: 'member to check mutes of', required: false })],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },

    /**
     * @param {import('discord.js').Message | import('discord.js').CommandInteraction} message
     * @param {string[]} args
     * @param {import('discord.js').Client} bot
     * @param {import('mysql2').Pool} db
     */
    async execute(message, args, bot, db) {
        /** @type {import('discord.js').GuildMember?} */
        const member = message.options.getMember('member');
        /** @type {import('discord.js').Role} */          
        const mutedRole = message.guild.roles.cache.get(bot.settings[message.guild.id].roles.muted);

        const embed = new EmbedBuilder()
            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
            .setColor(Colors.DarkButNotBlack)
            .setTimestamp()
            .setFooter({ text: `Ran by ${message.member.displayName}`, iconURL: message.member.displayAvatarURL() });

        if (!member) return await displayAllMutes(message, bot, db, mutedRole);
        
        embed.setTitle(`Mutes for ${member.displayName}`);
        const [rows] = await db.promise().query('SELECT * FROM mutes WHERE id = ? AND guildid = ? ORDER BY muted DESC, uTime DESC', [member.id, member.guild.id]);
        for (const row of rows) {
            const userText = ``
        }
    }
}

module.exports1 = {
    name: 'mutes',
    description: 'prints all muted members of the server',
    role: 'security',
    args: '[IGN | mention | id]',
    async execute(message, args, bot, db) {
        const memberSearch = args.shift();
        let member;
        if (memberSearch) {
            member = message.guild.members.cache.get(memberSearch);
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
            if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/gi, ''))
        }

        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: member ? `Mutes for ${member.nickname || member.user.tag} in ${message.guild.name}` : `Muted members in ${message.guild.name}` })
            .setDescription(`None!`)

            db.query(`SELECT * FROM mutes WHERE id = ${member.id} AND guildid = ${message.guild.id} ORDER BY muted DESC`, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot, message.guild);
                if (!rows || !rows.length)
                    return message.channel.send({ embeds: [embed] });
                for (const row of rows) {
                    if (row.muted)
                        fitStringIntoEmbed(embed, `**Ends <t:${(parseInt(row.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(row.uTime)/1000).toFixed(0)}:f> by <@!${row.modid}>: ${row.reason}**`);
                    else
                        fitStringIntoEmbed(embed, `Ended <t:${(parseInt(row.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(row.uTime)/1000).toFixed(0)}:f> by <@!${row.modid}>: ${row.reason}`);
                }
                message.channel.send({ embeds: [embed] });
    });
        

    }
}