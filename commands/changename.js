const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const prefix = require('../settings').prefix;
const ext = require('../lib/extensions');
const res = require('../lib/realmEyeScrape');

module.exports = {
    name: 'changename',
    description: 'Changes the name of a user and logs it automatically. If no proof is provided, checks the new name\'s name history.',
    alias: ['cn'],
    args: '<User id/mention> <new name> [proof]',
    requiredArgs: 2,
    role: 'security',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return message.channel.send(`Incorrect usage: ${prefix}changename <User id/mention> <new name> [proof]`);
        let member = message.mentions.members.first()
        if (!member)
            member = message.guild.members.cache.get(args.shift());
        else
            args.shift();

        if (!member)
            return message.channel.send(`Incorrect usage: ${prefix}changename <User id/mention> <new name> [proof]`);

        let altName = args.shift();
        let memberPrefix = '';
        let idx = 0;
        const names = [];
        if (member.nickname) {
            names.push(...member.nickname.replace(/\s+/gi, '').split('|'));
            for (let j = 0; j < names.length; j++) {
                const name = names[j].replace(/[^a-z]/gi, '');
                if (name == altName) //their name matches exactly
                    return message.channel.send(`They're already using the exact nickname ${altName}!`);
                if (name.toLowerCase() == altName.toLowerCase()) { //They have a case insensitive name match, request adjust name
                    idx = j;
                    if (names[idx][0].replace(/[a-z]/i, '') != '')
                        altName = names[idx][0] + altName;

                    return changeName(message, bot, settings, member, names, idx, altName);
                }
            }
            memberPrefix = names[idx][0].replace(/[a-z]/i, '');
        }

        let image;
        if (message.attachments.size) //attached image
            image = await message.attachments.first().proxyURL;
        else if (args.length) //image as last argument
            image = args.shift();

        if (image && !ext.isHttpURL(image)) { //image provided but it was not good
            return message.channel.send('There was an error retrieving the image.');
        }

        let historyName;
        let history;
        try {
            //get previous names
            history = await res.getNames(altName);
            if (history && history.length && (historyName = names.find(name => history.some(hist => hist.toLowerCase() == name.replace(/[^a-z]/i, '').toLowerCase())))) {
                //name history exists and one of the names in the user's nickname matched
                idx = names.indexOf(historyName);
                memberPrefix = names[idx][0].replace(/[a-z]/i, '');
                altName = history.find(h => h.toLowerCase() == altName.toLowerCase());
            }
            //if no image provided and there wasn't correct name history
            if (!historyName && !image)
                return message.channel.send(`There was no image provided and they do not have an account listed within ${altName}'s name change history.`);
        } catch (err) {}

        //new name length greater than 32?
        if ([altName, ...names.slice(0, idx), ...names.slice(idx + 1)].join(' | ').length > 32)
            return message.channel.send(`Changing ${member}'s name from \`${names[idx]}\` to \`${memberPrefix}${altName}\` will exceed the maximum nickname length of 32. Please remove an alt before changing.`);

        //anyone in the server with the name requested? Warn if so, but do not fail outright
        const dupe = message.guild.members.cache.find(m => m.nickname && m != member && m.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(altName.toLowerCase()));
        if (dupe)
            await message.channel.send(`Warning: Member ${dupe} already has the IGN ${altName}.`);

        altName = memberPrefix + altName;
        changeName(message, bot, settings, member, names, idx, altName, image, historyName, history);
    }
}

const changeName = async(message, bot, settings, member, names, idx, altName, image, historyName, history) => {
    const oldName = names[idx];
    names[idx] = altName;
    //if username is `Husky#1234` and ign is Husky, name change => husky, if name is huskY and ign is huskY, name change => husky
    for (let i = 0; names.join(' | ') == member.user.username && i < names[idx].length; i++) {
        names[idx] = altName;
        names[idx] = names[idx].slice(0, i) + names[idx][i].toLowerCase() + names[idx].slice(i + 1);
    }

    //if username is husky and ign is husky, name change => Husky
    for (let i = 0; names.join(' | ') == member.user.username && i < names[idx].length; i++) {
        names[idx] = altName;
        names[idx] = names[idx].slice(0, i) + names[idx][i].toUpperCase() + names[idx].slice(i + 1);
    }

    const confirm = await message.channel.send(`Are you sure you want to change ${member}'s name from \`${oldName}\` to \`${names[idx]}\`?`);
    try {
        if (await confirm.confirm(message.author.id)) {
            try {
                await member.setNickname(names.join(' | '));
            } catch (err) {
                message.channel.send(`There was an issue changing ${member}'s nickname: \`${err.toString().split('\n')[0]}\``)
                return ErrorLogger.log(err, bot);
            }
            let embed = new Discord.MessageEmbed()
                .setTitle(image || historyName ? 'Name Changed' : 'Name Adjusted')
                .setDescription(`${member}`)
                .addField('Old Name', oldName, true)
                .addField('New Name', names[idx], true)
                .addField('Change By', `${message.member}`)
                .setTimestamp(Date.now());
            if (image) //image was provided
                embed.setImage(image);
            if (historyName) { //name was found in name change history on RealmEye
                embed.setDescription(`**[Name History](https://www.realmeye.com/name-history-of-player/${names[idx]})** for ${member}`)
                const total = [];
                for (const old of history) {
                    total.push(old);
                    if (old == oldName)
                        break;
                }
                //Show name change history between the old name and the new name
                embed.addField('Found in Name History', `\`\`\`${total.reverse().join(' => ')}\`\`\``);
            }
            message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
            confirm.react('✅')
            confirm.edit(`Successfully changed name for ${member} from \`${oldName}\` to \`${altName}\`.`);
        } else
            confirm.edit(`Change name cancelled for ${member}.`);
    } catch (err) {
        message.channel.send(`There was an error changing ${member}'s name.`);
        ErrorLogger.log(err, bot);
    }
}