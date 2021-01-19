const Discord = require('discord.js')
const afkTemplates = require('../afkTemplates.json');
const botSettings = require('../settings.json');
const guildSettings = require('../guildSettings.json');
const fs = require('fs');
const MAX_WAIT = 60000;
Array.prototype.remove = function RemoveWhere(filter) {
    const found = this.find(filter);
    if (!found) return;
    this.splice(this.indexOf(found), 1);
}
Discord.Channel.prototype.next = function Next(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector((message) => !message.author.bot && (author_id ? message.author.id == author_id : true), { time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async(message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());

            const result = await message.delete();
            if (filter && !filter(result)) {
                resolved = false;
                error = message.channel.send(`${result.content} is not a valid input.\r\n${requirementMessage}\r\nType cancel to cancel.`)
                return;
            }
            collector.stop();
            resolve(result);
        })
        collector.on('end', () => {
            const err = 'Template creation timed out.';
            err.stack = new Error().stack;
            if (!resolved)
                reject(err)
        });
    });
};

Discord.Message.prototype.confirm = function ConfirmYesNo(author_id) {
    const filter = (reaction, user) => !user.bot && ['✅', '❌'].includes(reaction.emoji.name) && (author_id ? user.id == author_id : true);
    return new Promise((resolve, reject) => {
        const collector = this.createReactionCollector(filter, { time: MAX_WAIT });
        this.react('✅').then(this.react('❌'));
        let resolved = false;
        collector.once('collect', async(reaction, user) => {
            resolved = true;
            collector.stop();
            await this.reactions.removeAll();
            resolve(reaction.emoji.name === '✅');
        })
        collector.on('end', async() => {
            await this.reactions.removeAll();
            const err = 'Template creation timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        });
    })
}

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}
Discord.Channel.prototype.nextInt = function NextInt(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector((message) => !message.author.bot && (author_id ? message.author.id == author_id : true) && (!isNaN(message.content) || message.content.toLowerCase() === 'cancel'), { time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async(message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());
            const result = parseInt((await message.delete()).content);

            if (filter && !filter(result)) {
                resolved = false;
                error = message.channel.send(`${result} is not a valid input.\r\n${requirementMessage}\r\nType cancel to cancel.`);
                return;
            }

            collector.stop();
            resolve(result);
        });
        collector.on('end', () => {
            const err = 'Template creation timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        })
    })
}
const activeTemplateCreations = [];
module.exports = {
        name: 'createtemplate',
        description: 'Create a new AFK template',
        alias: ['ct', 'createt'],
        args: '',
        role: 'vetrl',
        checkActive: (id) => activeTemplateCreations.find(t => t.author === id),
        /**
         * Main Execution Function
         * @param {Discord.Message} message 
         * @param {String[]} args 
         * @param {Discord.Client} bot 
         * @param {import('mysql').Connection} db 
         * @param {import('mysql').Connection} tokenDB 
         */
        async execute(message, args, bot, db, tokenDB, event) {
            const author_id = message.author.id;
            //Must start it in vet commands
            if (message.channel.id != guildSettings[message.guild.id].channels.vetcommands) return;
            if (activeTemplateCreations.find(t => t.author == author_id))
                return message.channel.send('You are already in the process of creating a raiding template.');

            message.delete();

            activeTemplateCreations.push({ channel: message.channel.id, author: author_id });
            const embed = new Discord.MessageEmbed()
                .setColor(`#bae1ff`)
                .setTitle('Creating Veteran Raiding Template')
                .setAuthor(message.member.nickname, message.author.avatarURL())
                .setDescription('Which type of dungeon do you want to create a template for? Type cancel to cancel.')
                .setFooter(`UID: ${message.author.id} • Started at`)
                .setTimestamp(new Date());
            const data = { keyEmoteID: botSettings.emoteIDs.LostHallsKey, vialEmoteID: botSettings.emoteIDs.Vial };
            const dm = await message.channel.send({ embed });
            let emojiInfoMessage;
            try {
                //get run type
                data.runType = (await dm.channel.next(null, null, author_id)).content;
                embed.setDescription('What name do you want to give your run? Type cancel to cancel.')
                    .addField('Run Type', data.runType, true);
                await dm.edit(embed);

                //get run name
                data.runName = (await dm.channel.next(null, null, author_id)).content;
                embed.setDescription('What symbol do you want for this template? Type cancel to cancel.')
                    .addField('Run Name', data.runName, true);

                //get run symbol
                const unavailable = [];
                for (const key in afkTemplates) {
                    if (afkTemplates[key].symbol)
                        unavailable.push(afkTemplates[key].symbol);
                    else if (key == message.author.id) {
                        for (const key2 in afkTemplates[key])
                            unavailable.push(key2);
                    }
                }
                embed.addField('Unavailable Symbols', `\`\`\`${unavailable.join(', ')}\`\`\``);
                await dm.edit(embed);
                data.symbol = (await dm.channel.next((message) => message.content && !unavailable.some(u => u == message.content[0] || u == message.content), 'Symbol already in use. Please use a different symbol.', author_id)).content.toLowerCase();
                embed.fields.pop(); //remove unavailable symbols field

                //get reqs images
                embed.setDescription(`What image would you like to provide? (Type 'None' if you don't want one.) Type cancel to cancel.`)
                    .addField('Selected Symbol', data.symbol, true);
                await dm.edit(embed);
                const imageMsg = await dm.channel.next(null, null, author_id);
                const attachments = (imageMsg).attachments;
                data.reqsImageUrl = '';
                if (attachments && attachments.size)
                    embed.setImage(data.reqsImageUrl = attachments.first().proxyURL);
                else if (isValidHttpUrl(imageMsg.content))
                    embed.setImage(data.reqsImageUrl = imageMsg.content);
                else
                    embed.addField('Image', 'None!', true);

                //get split group
                embed.setDescription('Is this a split group?');
                await dm.edit(embed);
                data.isSplit = await dm.confirm(author_id);
                data.twoPhase = !data.isSplit;

                //get channel style
                embed.setDescription('Should this create a new channel?')
                    .addField('Is Split', data.isSplit ? 'yes' : 'no', true);
                await dm.edit(embed);
                data.newChannel = await dm.confirm(author_id);
                data.postAfkCheck = !data.newChannel;

                //get vial react
                embed.setDescription('Should this template have a vial react?')
                    .addField('Creates Channels', data.newChannel ? 'yes' : 'no', true);
                await dm.edit(embed);
                data.vialReact = await dm.confirm(author_id);

                //get start delay
                embed.setDescription('How much delay should the afk have before it starts? Please provide a number between 0 and 120 (in seconds). Type cancel to cancel.')
                    .addField('Has Vial React', data.vialReact ? 'yes' : 'no', true);
                await dm.edit(embed);
                data.startDelay = await dm.channel.nextInt(res => res >= 0 && res <= 120, 'Please enter a time period between 0 and 120 seconds.', author_id);
                const delaySeconds = data.startDelay % 60,
                    delayMinutes = (data.startDelay - delaySeconds) / 60;
                embed.addField('Start Delay', (delayMinutes ? `${delayMinutes} minutes ` : '') + `${delaySeconds} seconds`, true);
                data.startDelay *= 1000;

                //get vc cap
                embed.setDescription('How many users should the Voice Channel be capped to? Type cancel to cancel.');
                await dm.edit(embed);
                data.vcCap = await dm.channel.nextInt(res => res > 0, 'Please enter a number greater than 0.', author_id);

                //get time limit
                embed.setDescription('How long should the afk time limit be in seconds? Type cancel to cancel.')
                    .addField('Voice Channel Cap', `${data.vcCap}`, true);
                await dm.edit(embed);
                data.timeLimit = await dm.channel.nextInt(res => res > 0, 'Please enter a time period in seconds greater than 0.', author_id);
                const limitSeconds = data.timeLimit % 60,
                    limitMinutes = (data.timeLimit - limitSeconds) / 60;
                embed.addField('AFK Time Limit', (limitMinutes ? `${limitMinutes} minutes ` : '') + `${limitSeconds} seconds`, true);

                //get key count
                embed.setDescription('How many keys should be accepted? Type cancel to cancel.');
                await dm.edit(embed);
                data.keyCount = await dm.channel.nextInt(res => res > 0, 'Please enter a number of keys greater than 0.', author_id);

                embed.setDescription('Should this afk ping Void Boi or Cult Boi?')
                    .addField('Key Count', `${data.keyCount}`, true);
                await dm.edit(embed);

                //get ping role
                const guildRoles = guildSettings[message.guild.id].roles;
                data.pingRole = await new Promise((resolve, reject) => {
                    const collector = dm.createReactionCollector((reaction, user) => user.id == author_id && (reaction.emoji.name == '❌' || [botSettings.emoteIDs.voidd, botSettings.emoteIDs.malus].includes(reaction.emoji.id)), { time: MAX_WAIT });
                    let resolved = false;
                    dm.react(botSettings.emote.voidd)
                        .then(dm.react(botSettings.emote.malus))
                        .then(dm.react('❌'));
                    collector.once('collect', (reaction) => {
                        resolved = true;
                        collector.stop();
                        switch (reaction.emoji.id) {
                            case botSettings.emoteIDs.voidd:
                                return resolve('voidping');
                            case botSettings.emoteIDs.malus:
                                return resolve('cultping');
                            default:
                                return resolve('');
                        }
                    });
                    collector.on('end', () => {
                        if (!resolved)
                            reject('Template creation timed out.');
                    });
                });
                dm.reactions.removeAll();
                embed.addField('Ping Role', (message.guild.roles.cache.find((role) => role.id == guildRoles[data.pingRole]) || { name: data.pingRole || 'None!' }).name, true);
                //get early location cost
                //embed.setDescription('How much should early location cost in points? Type cancel to cancel.')
                await dm.edit(embed);
                data.earlyLocationCost = 30; //await dm.channel.nextInt(res => res >= 0, 'Please enter an amount of points greater than or equal to 0.', author_id);
                //embed.addField('Early Location Cost', `${data.earlyLocationCost}`, true);

                //get early location reacts
                embed.setDescription('Currently gathering template reactions.');
                await dm.edit(embed);

                const emojiInfo = new Discord.MessageEmbed().setDescription('React to this message with all early reactions. Any not accessible by me will be ignored. React to the ❌ to finish adding reactions.')
                emojiInfoMessage = await message.channel.send(emojiInfo);

                function GetAllReactions() {
                    return new Promise(async(resolve) => {
                        await emojiInfoMessage.react('❌');
                        const collector = emojiInfoMessage.createReactionCollector((reaction, user) => user.id == author_id, { time: MAX_WAIT * 3 });
                        collector.on('collect', (reaction) => {
                            if (reaction.emoji.name === '❌')
                                collector.stop();
                        });

                        collector.on('end', (collected) => {
                            const reacts = [...emojiInfoMessage.reactions.cache.array().map((reaction) => reaction.emoji).filter(emoji => message.client.emojis.cache.find((e) => e.id == emoji.id) && emoji.name !== '❌')];
                            emojiInfoMessage.reactions.removeAll();
                            resolve(reacts);
                        });
                    });
                }

                data.earlyLocationReacts = [];
                const earlyReacts = (await GetAllReactions()).slice(0, 23);
                for (const emoji of earlyReacts) {
                    const reaction = { emoteID: emoji.id };
                    emojiInfo.setDescription(`${emoji}: How many people should get early location?`);
                    await emojiInfoMessage.edit(emojiInfo);
                    reaction.limit = await emojiInfoMessage.channel.nextInt(res => res > 0, 'Please enter a number equal to or greater than 1.', author_id);

                    // emojiInfo.setDescription(`${emoji}: How many points should be given for this react?`);
                    // await emojiInfoMessage.edit(emojiInfo);
                    reaction.pointsGiven = 0; //await emojiInfoMessage.channel.nextInt(res => res >= 0, 'Please enter a number equal to or greater than 0.', author_id);

                    emojiInfo.setDescription(`${emoji}: What is the short name of the react? No spaces allowed`);
                    await emojiInfoMessage.edit(emojiInfo);
                    reaction.shortName = (await emojiInfoMessage.channel.next(res => !/\s/.test(res), 'Please enter a value without spaces.', author_id)).content.toLowerCase();

                    /* Add check realmeye at some point
                     * 
                     * "checkRealmEye": {
                     *    "class": "mystic",
                     *    "ofEight": "8",
                     *    "mheal": "85",
                     *    "orb": "2"
                     * }
                     */
                    emojiInfo.setDescription(`${emoji}: Does this emoji have a required role?`);
                    await emojiInfoMessage.edit(emojiInfo);
                    if (await emojiInfoMessage.confirm(author_id)) {
                        function GetRoleSelection() {
                            return new Promise(async(resolve, reject) => {
                                let rolesMessage;
                                try {
                                    const rolesEmbed = new Discord.MessageEmbed()
                                        .setColor("#000000")
                                        .setAuthor("Roles List")
                                        .setDescription("Choose from the following roles which should be the required role:");
                                    const selections = [];
                                    let roleList = ['\r\n0\r\nNo Role'];

                                    for (const rolename in guildRoles) {
                                        if (!guildRoles[rolename])
                                            continue;

                                        const role = message.guild.roles.resolve(guildRoles[rolename]);
                                        if (!role)
                                            continue;

                                        selections.push({ rolename, id: role.id, role });
                                        roleList.push(`\r\n${selections.length} ${role}`);
                                        if (roleList.length == 5) {
                                            rolesEmbed.addField('** **', `**${roleList.join('\r\n')}**`, true)
                                            roleList = [];
                                        }
                                    }
                                    if (roleList.length)
                                        rolesEmbed.addField('** **', `**${roleList.join('\r\n')}**`, true)
                                    rolesMessage = await emojiInfoMessage.channel.send(rolesEmbed);
                                    const selection_idx = await emojiInfoMessage.channel.nextInt(res => res >= 0 && res <= selections.length, `Please enter a value between 0 and ${selections.length}. Enter 0 for no role.`, author_id);
                                    rolesMessage.delete();
                                    resolve(selection_idx == 0 ? null : selections[selection_idx - 1]);
                                } catch (err) {
                                    if (rolesMessage) rolesMessage.delete();
                                    reject(err);
                                }
                            })
                        }

                        reaction.requiredRole = await GetRoleSelection();
                    }

                    data.earlyLocationReacts.push(reaction);
                    emojiInfo.addField(`${emoji} ${reaction.shortName} ${emoji}`, `*Early React*\r\nPoints Given: ${reaction.pointsGiven}\r\nReaction Limit: ${reaction.limit}${reaction.requiredRole? `\r\nRequired Role:\r\n${reaction.requiredRole.role}` : ''}`, true)
                if (reaction.requiredRole)
                    reaction.requiredRole = reaction.requiredRole.rolename;
            }

            emojiInfo.setDescription('React to this message with all other reactions. Any not accessible by me will be ignored. React to the ❌ to finish adding reactions.')
            await emojiInfoMessage.edit(emojiInfo);
            data.reacts = (await GetAllReactions());
            if (data.reacts && data.reacts.length) {
                emojiInfo.addField('Other Reactions', data.reacts.join(' '));
                data.reacts = data.reacts.map(emoji => emoji.id);
            }
            await emojiInfoMessage.edit(emojiInfo);

            emojiInfo.setDescription('Reactions for this raiding template');
            await emojiInfoMessage.edit(emojiInfo);
            data.embed = {};

            //get embed color
            embed.setDescription('What color would you like the embed to be? Please give a hex color code in the form `#123abc`. Type cancel to cancel.');
            await dm.edit(embed);
            data.embed.color = (await dm.channel.next(({ content }) => /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(content), 'Please give a hex color code in the form `#123abc`.', author_id)).content;

            embed.setDescription('What color would you like the text of the embed to be? Please give a hex color code in the form `#123abc`. Type cancel to cancel.')
                .addField('Color', data.embed.color, true);
            await dm.edit(embed);
            data["font-color"] = (await dm.channel.next(({ content }) => /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(content), 'Please give a hex color code in the form `#123abc`.', author_id)).content;

            //get embed description
            embed.setDescription('What description do you want to use for your AFK check? Type cancel to cancel.')
                .addField('Text Color', data["font-color"], true);
            await dm.edit(embed);
            data.embed.description = (await dm.channel.next(null, null, author_id)).content;

            embed.setDescription('Are you sure you want to create the following raiding template?')
                .addField('Description', data.embed.description, true);
            await dm.edit(embed);
            if (!await dm.confirm(author_id))
                throw 'Manually cancelled.';

            if (!afkTemplates[message.author.id])
                afkTemplates[message.author.id] = {};

            afkTemplates[message.author.id][data.symbol] = data;
            fs.writeFileSync(require.resolve('../afkTemplates.json'), JSON.stringify(afkTemplates));
            embed.setTitle("Successfully Created Raiding Template")
                .setColor("#00ff00")
                .setDescription("Successfully created the following raiding template:")
                .setFooter(`UID: ${message.author.id} • Symbol: ${data.symbol} • Created at`)
                .setTimestamp(new Date());;
            emojiInfo.setColor("#00ff00");
            emojiInfoMessage.edit(emojiInfo);
            dm.edit(embed);
            bot.channels.resolve(guildSettings[message.guild.id].channels.history).send(embed).then(m => m.channel.send(emojiInfo));
            activeTemplateCreations.remove(t => t.author == message.author.id); 
        } catch (error) {
            activeTemplateCreations.remove(t => t.author == message.author.id); 
            console.log(error);
            embed.setTitle('Raiding Template Cancelled')
                .setColor('#ff0000')
                .setDescription(error.stack || error)
                .setFooter(`UID: ${message.author.id} • Cancelled at`)
                .setTimestamp(new Date());
            dm.edit(embed);
            if (emojiInfoMessage)
            {
                emojiInfoMessage.embeds[0].setColor('#ff0000')
                    .setFooter(`Cancelled at`)
                    .setTimestamp(new Date())
                    .setTitle('Raiding Template Cancelled');
                emojiInfoMessage.edit(emojiInfoMessage.embeds[0]);
            }
        }
    }
};