const Discord = require('discord.js')
const getFeedback = require('./getFeedback')
const ErrorLogger = require('../lib/logError')

const num_words = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '❌']

const guilds = require('../voteInfo.json')

module.exports = {
    name: 'vote',
    role: 'headrl',
    args: '<ign> [igns...]',
    requiredArgs: 1,
    description: 'Puts up a vote for promotions based on users current role.',
    getNotes(guildid, member) {
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
            promotion = await retrievePromotionType(settings, message.channel, message.author, member, role, info).catch(err => ErrorLogger.log(err, bot));
        if (!promotion) return message.channel.send(`Cancelled vote for ${member}`);

        await db.query(`SELECT * FROM users WHERE id = ${member.id}`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot);
            const feedback = await getFeedback.getFeedback(member, message.guild, bot);
            const promo_role = message.guild.roles.cache.get(settings.roles[promotion]);
            const embed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setAuthor(`${member.nickname} to ${promo_role.name}`, member.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`${member}\n`);

            const min_role = Object.keys(promos)[Object.keys(promos).length - 2];
            if (rolekey != min_role) {
                if (rows[0]) embed.description += `Runs Logged: ` + promos.db_rows.map(r => `${rows[0][r[1]]} ${r[0]}`).join(', ');
                else embed.description += 'Issue getting runs';
                embed.addField(`Recent Feedback:`, '** **');
            } else embed.addField('Feedback:', '** **');

            feedback.forEach(m => {
                const link = `[Link](${m}) `;
                let field = embed.fields[embed.fields.length - 1];
                if (field.value.length + link.length < 1024)
                    field.value += link;
                else if (embed.fields.length < 15)
                    embed.addField('-', `[Link](${m}) `);
            });

            const msg = await message.guild.channels.cache.get(settings.channels[guilds.channels[rolekey]]).send(embed);
            await msg.react('✅');
            await msg.react('😐');
            await msg.react('❌');
            if (rolekey == 'almostrl')
                await msg.react('👀');
        })
        return;
    }

    return message.channel.send(`${member} doesn't have a role eligible for promotion`);
}

function retrievePromotionType(settings, channel, author, member, role, info) {
    return new Promise(async (resolve, reject) => {
        const embed = new Discord.MessageEmbed()
            .setColor('#0000ff')
            .setAuthor(`Choose Promotion for ${member.nickname}`, member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`There are multiple promotion paths for ${role}. Choose one of the following:` +
                info.map((v, i) => `${num_words[i]}: **${member.guild.roles.cache.get(settings.roles[v])}**`).join('\n'));

        const message = await channel.send(embed);

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
    let voteEmbed = new Discord.MessageEmbed()
        .setColor('#ff0000')
        .setAuthor(`${member.nickname} to ${voteType}`)
        .setDescription(`${member}\n`)
    if (member.user.avatarURL()) voteEmbed.author.iconURL = member.user.avatarURL()
    db.query(`SELECT * FROM users WHERE id = ${member.id}`, async (err, rows) => {
        if (err) ErrorLogger.log(err, bot)
        if (voteType != 'Almost Raid Leader')
            if (rows[0]) {
                voteEmbed.description += `Runs Logged: \`${rows[0].voidsLead}\` Voids, \`${rows[0].cultsLead}\` Cults\nRecent Feedback:\n`
            } else voteEmbed.description += `Issue getting runs\nRecent Feedback:\n`
        else voteEmbed.description += `Feedback:\n`
        let cont = true
        feedback.forEach(m => {
            if (cont)
                if (voteEmbed.description.length + `[Link](${m}) `.length < 2048) voteEmbed.description += `[Link](${m}) `
                else cont = false
        })
        let m = await channel.send(voteEmbed)
        await m.react('✅')
        await m.react('😐')
        await m.react('❌')
        if (voteType == 'Raid Leader') {
            m.react('👀')
        }
    })

}