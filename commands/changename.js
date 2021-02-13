const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const prefix = require('../settings').prefix;
const ext = require('../lib/extensions');
const res = require('../lib/realmEyeScrape');

module.exports = {
    name: 'changename',
    description: 'Changes the name of a user and logs it automatically.',
    alias: ['cn'],
    args: '<new name>',
    requiredArgs: 1,
    notes: 'Security+: [mention | ID] <new name> [proof]',
    role: 'raider',
    async execute(message, args, bot) {
        const settings = bot.settings[message.guild.id];
        const staff = message.member.roles.highest.comparePositionTo(message.guild.roles.cache.get(settings.roles.security)) >= 0;
        const arg_list = prefix + 'changename ' + (staff ? this.args : '<new name>');
        try {
            if (!staff && args.length != 1)
                throw `Invalid arguments: ${arg_list}`;
            if (args.length == 1)
                await this.change(message, message.member, args.shift(), args, bot, settings, staff);
            else {
                const member_arg = args.shift(),
                    member_id = member_arg.replace(/[^0-9]/gi, '');
                const member = message.guild.members.cache.get(member_id);
                if (!member)
                    throw `Could not find member ${member_arg} (id: ${member_id})`;

                await this.change(message, member, args.shift(), args, bot, settings, staff);
            }
        } catch (err) {
            message.channel.send(err);
        }
    },
    async change(message, member, altName, args, bot, settings, staff) {
        return new Promise(async(resolve, reject) => {
            const own = message.member == member;
            altName = altName.replace(/[^a-z]/gi, '');
            if (!staff && altName.length > 10)
                return reject(`An IGN cannot be more than 10 characters under normal circumstances. If you are an exception, please contact a Security+ staff member.`);

            let userPrefix = '',
                nickname = member.nickname || '',
                idx = 0;


            if (nickname.length && /[^a-z]/gi.test(nickname[0])) {
                userPrefix = nickname[0];
                nickname = nickname.slice(1);
            }
            const names = (nickname || '').replace(/\s+/gi, '').split('|');

            //Check if it's a superficial change
            for (let j = 0; j < names.length; j++) {
                if (names[j] == altName) //their name matches exactly
                    return reject((own ? `You already have` : `${member} already has`) + ` the nickname ${altName}!`);
                if (names[j].toLowerCase() == altName.toLowerCase()) { //They have a case insensitive name match, request adjust name
                    idx = j;

                    return changeName(message, bot, settings, member, names, idx, altName, userPrefix).catch(err => reject(err));
                }
            }

            let image;
            if (staff) {
                if (message.attachments.size) //attached image
                    image = await message.attachments.first().proxyURL;
                else if (args.length) //image as last argument
                    image = args.shift();

                if (image && !ext.isHttpURL(image)) { //image provided but it was not good
                    reject('There was an error retrieving the image.');
                }
            }

            const data = await nameHistory(altName, names);
            if (!data || !data.historyName) {
                //need to be both staff and it must have an image attached to change a name not in name history
                if (!staff || !image)
                    return reject((own ? 'Your' : `${member}'s`) +
                        ` name change history is private or ${altName} is on a separate account from one ${own ? 'you' : 'they'} own.\r\n${ 
                            staff? 
                            'Please make sure to attach an image for accounts not in ' + (own ? 'your' : 'their') + ' name change history.': 
                            'If you would still like to change your name to ' + altName + ', please contact a Security+ staff member.'}`);
            }

            if (data) {
                if (data.altName)
                    altName = data.altName;
                if (typeof data.idx === 'number')
                    idx = data.idx;
                if (data.memberPrefix)
                    userPrefix = data.memberPrefix;
            }
            //new name length greater than 32?
            if ([altName, ...names.slice(0, idx), ...names.slice(idx + 1)].join(' | ').length > 32)
                return message.channel.send(`Changing ${own ? 'your' : '<@!' + member.id + ">'s"} name from \`${names[idx]}\` to \`${userPrefix}${altName}\` will exceed the maximum nickname length of 32. Please${own ? ' ' : ' ask staff to '}remove an alt before proceeding.`);

            //anyone in the server with the name requested? Warn if so, but do not fail outright
            const dupe = message.guild.members.cache.find(m => m.nickname && m != member && m.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(altName.toLowerCase()));
            if (dupe) {
                if (!staff)
                    return reject(`There is already a user with the IGN ${altName} in the server. If this is in fact your name, please contact a Security+ staff member to resolve the issue immediately.`);
                await message.channel.send(`Warning: Member ${dupe} already has the IGN ${altName}.`);

            }
            const { historyName, history } = data;
            return await changeName(message, bot, settings, member, names, idx, altName, userPrefix, image, historyName, history).catch(err => reject(err));
        });
    }
}

const nameHistory = async(altName, names) => {
    let historyName;
    let history;
    let memberPrefix = '';
    let idx = 0;
    try {
        //get previous names
        history = await res.getNames(altName);
        if (history && history.length && (historyName = names.find(name => history.some(hist => hist.toLowerCase() == name.replace(/[^a-z]/i, '').toLowerCase())))) {
            //name history exists and one of the names in the user's nickname matched
            idx = names.indexOf(historyName);
            memberPrefix = names[idx][0].replace(/[a-z]/i, '');
            altName = history.find(h => h.toLowerCase() == altName.toLowerCase());
        }
        return { history, historyName, memberPrefix, altName, idx };
    } catch (err) { console.log(err) }
}

const changeName = async(message, bot, settings, member, names, idx, altName, userPrefix, image, historyName, history) => {
    return new Promise(async(resolve, reject) => {
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

        const confirm = await message.channel.send(`Are you sure you want to change ${member}'s name from \`${oldName || ' '}\` to \`${names[idx]}\`?`);
        try {
            if (await confirm.confirm(message.author.id)) {
                const oldNickname = member.nickname;
                try {
                    await member.setNickname(userPrefix + names.join(' | '));
                } catch (err) {
                    reject(`There was an issue changing ${member}'s nickname: \`${err.toString().split('\n')[0]}\``)
                    return ErrorLogger.log(err, bot);
                }
                let embed = new Discord.MessageEmbed()
                    .setTitle(image || historyName ? 'Name Changed' : 'Name Adjusted')
                    .setDescription(`${member} \`${member.user.tag}\``)
                    .addField('Old Name', `\`${oldName || ' '}\` in \`${oldNickname || ' '}\``)
                    .addField('New Name', `\`${names[idx]}\``)
                    .addField('Change By', `${message.member} \`${message.member.user.tag}\``)
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
                confirm.edit(`Successfully changed name for ${member} from \`${oldName || ' '}\` to \`${names[idx]}\`.`);
            } else {
                confirm.edit(`Change name cancelled for ${member}.`);
            }
            resolve();
        } catch (err) {
            reject(`There was an error changing ${member}'s name.`);
            ErrorLogger.log(err, bot);
        }
    });
}