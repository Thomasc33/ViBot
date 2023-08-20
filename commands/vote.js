const Discord = require('discord.js')
const getFeedback = require('./getFeedback')
const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

const num_words = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '❌']

const guilds = require('../data/voteInfo.json')

module.exports = {
    name: 'vote',
    role: 'headeventrl',
    args: '<ign> [igns...]',
    requiredArgs: 1,
    description: 'Puts up a vote for promotions based on users current role.',
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: "Staff Member"
        }),
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild)
    },
    getNotes(guild, member, bot) {
        return 'Puts the message in leader-chat/veteran-rl-chat based on vote'
    },
    async execute(message, args, bot, db) {
        if (args.length == 0) return;
        for (let i in args) {
            let member = message.guild.members.cache.get(args[i])
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[i].toLowerCase()));
            if (!member) {
                message.channel.send(`Issue finding ${args[i]}. Try again`);
                continue;
            }
            postVote2(message, member, bot, db)
        }
        message.delete()
    }
}

async function postVote2(message, member, bot, db) {
    const settings = bot.settings[message.guild.id];
    if (!settings) return;

    const promos = guilds[message.guild.id] || guilds.default;
    for (let [rolekey, info] of Object.entries(promos)) {

        if (rolekey == 'db_rows') continue;
        if (!settings.roles[rolekey]) continue;
        const role = message.guild.roles.cache.get(settings.roles[rolekey]);

        if (!role) continue;

        if (!member.roles.cache.has(role.id)) continue;

        info = info.filter(r => {
            r = message.guild.roles.cache.get(settings.roles[r]);
            return r && !member.roles.cache.has(r.id)
        });
        if (info.length == 0)
            continue;
        let promotion = info[0];
        if (info.length > 1)
            promotion = await retrievePromotionType(settings, message.channel, message.author, member, role, info).catch(err => ErrorLogger.log(err, bot, message.guild));
        if (!promotion) return message.channel.send(`Cancelled vote for ${member}`);

        const rows = await db.promise().query(`SELECT * FROM users WHERE id = ${member.id}`).catch((err) => ErrorLogger.log(err, bot, message.guild))
        const feedback = await getFeedback.getFeedback(member, message.guild, bot);
        const promo_role = message.guild.roles.cache.get(settings.roles[promotion]);
        const embed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: `${member.nickname} to ${promo_role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`${member}\n`);

        const min_role = Object.keys(promos)[Object.keys(promos).length - 2];
        if (rolekey != min_role) {
            if (rows[0]) embed.data.description += `Runs Logged: ` + promos.db_rows.map(r => `${rows[0][r[1]]} ${r[0]}`).join(', ');
            else embed.data.description += 'Issue getting runs';
            embed.addFields([{name: `Recent Feedback:`, value: '** **'}]);
        } else embed.addFields([{name: 'Feedback:', value: '** **'}]);

        feedback.forEach(m => {
            const link = `[Link](${m}) `;
            let field = embed.data.fields[embed.data.fields.length - 1];
            if (field.value.length + link.length < 1024)
                field.value += link;
            else if (embed.data.fields.length < 15)
                embed.addFields([{name: '-', value: `[Link](${m}) `}]);
        });

        const msg = await message.guild.channels.cache.get(settings.channels[guilds.channels[rolekey]]).send({ embeds: [embed] });
        await msg.react('✅');
        if (!['343704644712923138', '708026927721480254', '701483950559985705'].includes(message.guild.id)) {
            await msg.react('😐')
        }
        await msg.react('❌');
        if (rolekey == 'almostrl' && message.guild.id !== '708026927721480254') {
            await msg.react('👀')
        }
        try
        { 
            if (rolekey == 'rl' && message.guild.id == '708026927721480254') {
                await msg.react('🇷')
                await msg.react('🇫')
            }
        }
        catch (e) {
            ErrorLogger.log(e, bot, message.guild.id)
        }
        return;
    }

    return message.channel.send(`${member} doesn't have a role eligible for promotion`);
}

function retrievePromotionType(settings, channel, author, member, role, info) {
    return new Promise(async (resolve, reject) => {
        const embed = new Discord.EmbedBuilder()
            .setColor('#0000ff')
            .setAuthor({ name: `Choose Promotion for ${member.nickname}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`There are multiple promotion paths for ${role}. Choose one of the following:` +
                info.map((v, i) => `${num_words[i]}: **${member.guild.roles.cache.get(settings.roles[v])}**`).join('\n'));

        const message = await channel.send({ embeds: [embed] });

        const collector = message.createReactionCollector((reaction, user) => !user.bot && user.id == author.id && num_words.indexOf(reaction.emoji.name) >= 0, { time: 30000 });
        let resolved = false;

        collector.once('collect', async (reaction, user) => {
            resolved = true;
            collector.stop();
            if (reaction.emoji.name == '❌')
                return resolve();
            return resolve(info[num_words.indexOf(reaction.emoji.name)]);

        });

        collector.on('end', () => {
            message.delete();
        });

        for (const i in info) {
            if (resolved)
                return;
            await message.react(num_words[i]).catch(() => { });
        }
        if (!resolved)
            await message.react('❌').catch(() => { });
    })
}

async function postVote(message, member, bot, db) {
    let settings = bot.settings[message.guild.id]
    let voteType
    if (member.roles.cache.has(settings.roles.fullskip)) {
        voteType = 'Veteran Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(settings.roles.rl)) {
        voteType = 'Fullskip'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(settings.roles.almostrl)) {
        voteType = 'Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else if (member.roles.cache.has(settings.roles.trialrl)) {
        voteType = 'Almost Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else return message.channel.send(`${member} doesn't have a role eligible for promotion`)
    let feedback = await getFeedback.getFeedback(member, message.guild, bot)
    let voteEmbed = new Discord.EmbedBuilder()
        .setColor('#ff0000')
        .setAuthor({ name: `${member.nickname} to ${voteType}` })
        .setDescription(`${member}\n`)
    if (member.user.avatarURL()) voteEmbed.setAuthor({ name: `${member.nickname} to ${voteType}`, iconURL: member.user.avatarURL() })
    db.query(`SELECT * FROM users WHERE id = ${member.id}`, async (err, rows) => {
        if (err) ErrorLogger.log(err, bot, message.guild)
        if (voteType != 'Almost Raid Leader')
            if (rows[0]) {
                voteEmbed.data.description += `Runs Logged: \`${rows[0].voidsLead}\` Voids, \`${rows[0].cultsLead}\` Cults\nRecent Feedback:\n`
            } else voteEmbed.data.description += `Issue getting runs\nRecent Feedback:\n`
        else voteEmbed.data.description += `Feedback:\n`
        let cont = true
        feedback.forEach(m => {
            if (cont)
                if (voteEmbed.data.description.length + `[Link](${m}) `.length < 2048) voteEmbed.data.description += `[Link](${m}) `
                else cont = false
        })
        let m = await channel.send({ embeds: [voteEmbed] })
        await m.react('✅')
        await m.react('😐')
        await m.react('❌')
        if (voteType == 'Raid Leader') {
            m.react('👀')
        }
    })

}
