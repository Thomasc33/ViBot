const Discord = require('discord.js')
const afkTemplates = require('../afkTemplates.json');
const botSettings = require('../settings.json');
const guildSettings = require('../guildSettings.json');
const eventTemplates = require('../data/events.json');
const fs = require('fs');
const ext = require('../lib/extensions.js');

Array.remove = function RemoveWhere(arr, filter) {
    const found = arr.find(filter);
    if (!found) return;
    return arr.splice(arr.indexOf(found), 1)[0];
}

function secondsToStr(sec) {
    const limitSeconds = sec % 60,
        limitMinutes = (sec - limitSeconds) / 60;
    return (limitMinutes ? `${limitMinutes} minutes ` : '') + `${limitSeconds} seconds`;
}

function timeFromTimeStr(str) {
    const match = str.match(/^\s*((?<minutes>\d+)\s*m(in(ute)?s?)?)?\s*((?<seconds>\d+)\s*s(ec(ond)?s?)?)?/)
    if (!match.groups.minutes && !match.groups.seconds) {
        const min = parseInt(str);
        if (isNaN(min))
            return min;

        return { min, sec: 0, total: min * 60 };
    }
    const min = parseInt(match.groups.minutes || 0),
        sec = parseInt(match.groups.seconds || 0),
        total = min * 60 + sec;
    return { min, sec, total };
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
const yn = (b) => b ? 'Yes' : 'No';

class AfkTemplate {
    constructor(original, bot, data, symbol) {
        this.data = data || { earlyLocationReacts: [], reacts: [], embed: {}, keyEmoteID: "701491230260985877" };
        if (!data)
            this.brandnew = true;
        this.symbol = symbol;
        this.original = original;
        this.author = this.original.author;
        this.nickname = this.original.member.nickname.split('|')[0].trim();
        this.embed = new Discord.MessageEmbed()
            .setTitle('Raiding Template Editor')
            .setColor('#82EEFD')
            .setAuthor(`Editing ${this.nickname}'s Raiding Template`, this.author.avatarURL())
            .setFooter(`UID: ${this.author.id}`)
            .setImage(this.data.reqsImageUrl)
            .setTimestamp(new Date());
        this.reactEmbed = new Discord.MessageEmbed()
            .setTitle('Reaction List')
            .setColor('#82EEFD');
        this.bot = bot;
        this.guild = this.original.guild;
    }

    async build() {
        await this.updateDM();
    }
    get fields() {
        const f = [
            { name: 'VC Name', value: this.data.runType || 'None!', inline: true },
            { name: 'Run Name', value: this.data.runName || 'None!', inline: true },
            { name: 'Key Type', value: `${this.bot.emojis.resolve(this.data.keyEmoteID || "701491230260985877")}`, inline: true },
            { name: 'AFK Symbol', value: this.symbol || 'None!', inline: true }
        ];
        if (!this.data.reqsImageUrl)
            f.push({ name: 'Image', value: 'None!', inline: true });
        f.push({ name: 'Ping Role', value: this.data.pingRole || 'None!', inline: true }, { name: 'Split Group', value: yn(this.data.isSplit), inline: true }, { name: 'New Channel', value: yn(this.data.newChannel), inline: true }, { name: 'Needs Vial', value: yn(this.data.vialReact), inline: true }, { name: 'VC Lock Phase', value: yn(this.data.twoPhase), inline: true }, { name: 'VC Cap', value: this.data.vcCap || 1, inline: true }, { name: 'AFK Time Limit', value: secondsToStr(this.data.timeLimit || 360), inline: true }, { name: 'Key Reacts', value: this.data.keyCount || 1, inline: true }, { name: 'Embed Color', value: this.data.embed.color || '#2f075c', inline: true }, { name: 'Font Color', value: this.data['font-color'] || '#eeeeee', inline: true }, { name: 'Description', value: this.data.embed.description || 'None!', inline: false });

        return f;
    }
    async preview(channel, requestor) {
        const preview = new Discord.MessageEmbed()
            .setDescription(this.data.description)
            .setAuthor(`A ${this.data.runType} Has Been Started in ${this.author}'s ${this.data.runName}`, this.author.avatarURL())
            .setImage(this.data.reqsImageUrl)
            .setFooter(`Time Remaining: 1 minute`)
            .setTimestamp(new Date());
        const message = await channel.send('***This is a preview***\r\nReact to the ❌ to remove it. Preview will timeout automatically after 45 seconds', preview);
        await message.react(this.data.keyEmoteID);
        if (this.data.vialReact)
            await message.react(this.data.vialEmoteID);
        for (const react of this.data.earlyLocationReacts)
            await message.react(react.emoteID);
        await message.react('701491230349066261');
        await message.react('🎟️');
        await message.react('❌')
        for (const react of this.data.reacts)
            await message.react(react);
        const collector = message.createReactionCollector((reaction, user) => user.id == requestor.id && reaction.emoji.name == '❌', { time: 45000 });
        collector.once('collect', () => message.delete());
        collector.once('end', () => message.deleted || message.delete());
    }
    get channel() {
        if (this.dmChannel)
            return this.dmChannel;

        this.dmChannel = new Promise(res => res(this.original.channel));

        try {
            const channel = this.guild.channels.create(`${this.nickname}'s Template Channel`, {
                type: 'text',
                topic: 'Edit your veteran raiding template here',
                parent: this.original.channel.parent,
                position: this.original.channel.position - 1,
                reason: `For creating or editing the raiding template for ${this.author}`,
                permissionOverwrites: [{
                    id: this.guild.roles.everyone.id,
                    deny: ['VIEW_CHANNEL']
                },
                {
                    id: this.author.id,
                    allow: ['ADD_REACTIONS', 'SEND_MESSAGES', 'VIEW_CHANNEL', 'EMBED_LINKS', 'ATTACH_FILES', 'USE_EXTERNAL_EMOJIS']
                }, {
                    id: this.bot.user,
                    allow: ['ADD_REACTIONS', 'SEND_MESSAGES', 'VIEW_CHANNEL', 'EMBED_LINKS', 'ATTACH_FILES', 'USE_EXTERNAL_EMOJIS']
                }
                ]
            });
            this.dmChannel = channel;
        } catch (err) {
            this.message.channel.send(`There were issues creating template channel: ${err}. You may continue doing so in this channel.`);
        }
        return this.dmChannel;
    }
    get dm() {
        if (this.dmMessage)
            return this.dmMessage;

        return this.dmMessage = this.channel.then(c => c.send(this.embed));
    }
    async updateDM(description) {
        this.embed.fields = this.fields;
        if (description)
            this.embed.setDescription(description);
        await this.dm.then(d => d.edit(this.embed));
    }
    async updateReacts(description) {
        if (description)
            this.reactEmbed.setDescription(description);
        this.reactEmbed
            .setFooter(`UID: ${this.author.id} • MSG: ${await this.dm.then(d => d.id)}`)
            .setAuthor(`${this.nickname}'s ${this.data.runType} Reactions`);
        const fields = [];
        for (const reaction of this.data.earlyLocationReacts) {
            const emoji = this.bot.emojis.resolve(reaction.emoteID);
            const role = this.guild.roles.resolve(guildSettings[this.guild.id].roles[reaction.requiredRole]);
            fields.push({
                name: `${emoji} ${reaction.shortName} ${emoji}`,
                value: `*Early React*\r\nPoints Given: ${reaction.pointsGiven}\r\nReaction Limit: ${reaction.limit}${reaction.requiredRole ? '\r\nRequired Role:\r\n' : role}`
            });
        }
        console.log(this.data.reacts);
        fields.push({
            name: `Non-early Reacts`,
            value: this.data.reacts.map(r => this.bot.emojis.resolve(r)).join(' ') || 'None!'
        });

        this.reactEmbed.fields = fields;
        await this.rm.then(r => r.edit(this.reactEmbed));
    }
    get rm() {
        if (this.reactMessage)
            return this.reactMessage;

        return this.reactMessage = this.channel.then((c) => c.send(this.reactEmbed));
    }
    async editRunType() {
        await this.updateDM('**VC Name**: What name do you want to give the VC? Type cancel to cancel');
        this.data.runType = (await this.channel.then(c => c.next(null, null, this.author.id))).content;
    }
    async editRunName() {
        await this.updateDM('**Run Name**: What name do you want to give the run? Type cancel to cancel');
        this.data.runName = (await this.channel.then(c => c.next(null, null, this.author.id))).content;
    }
    async editKeyType() {
        await this.updateDM('**Key Type**: What type of key should this run use?');
        const emoji = await new Promise(async (resolve, reject) => {
            const embed = new Discord.MessageEmbed()
                .setDescription('React with the key this run should accept. React with :x: to cancel')
                .setTitle('Key Selection')
                .setColor('#dadada');
            const keySelection = await this.channel.then((c) => c.send(embed));
            const collector = keySelection.createReactionCollector((reaction, user) => { reaction.me && user.id == this.author.id }, { time: ext.MAX_WAIT });
            let resolved = false;
            collector.once('collect', (reaction, user) => {
                resolved = true;
                keySelection.delete();
                if (reaction.emoji.name === '❌')
                    reject('Manually cancelled.');
                resolve(reaction.emoji);
            });
            collector.once('end', () => {
                if (!keySelection.deleted)
                    keySelection.delete();
                if (!resolved) {
                    reject('Key type selection timed out.')
                }
            })
            await keySelection.react('❌');
            await keySelection.react(botSettings.emoteIDs.LostHallsKey);
            for (const event in eventTemplates)
                keySelection.react(eventTemplates[event].keyEmojiId);
        });
        this.data.keyEmoteID = emoji.id;
    }
    async editSymbol() {
        await this.updateDM('**Symbol**: What symbol do you want to use to start this afk check (aka. `;afk symbol`)? First letter must be unique. Type cancel to cancel');
        const unavailable = [];

        for (const key in afkTemplates) {
            if (afkTemplates[key].keyEmoteID) {
                unavailable.push(key.toLowerCase());
                if (!unavailable.includes(afkTemplates[key].symbol.toLowerCase()))
                    unavailable.push(afkTemplates[key].symbol.toLowerCase());
            } else if (key == this.author.id) {
                for (const key2 in afkTemplates[key])
                    unavailable.push(key2.toLowerCase());
            }
        }

        const embed = new Discord.MessageEmbed()
            .setDescription(`\`\`\`${unavailable.join(', ')}\`\`\``)
            .setAuthor('Unavailable symbols');
        const msg = await (await this.channel).send(embed);
        this.symbol = (await this.channel.then(c => c.next((message) => {
            return message.content &&
                !/\s+/.test(message.content) &&
                !unavailable.some(u => u[0] == message.content[0].toLowerCase())
        }, 'Symbol is either already in use or contains a space. Please use a different symbol. The first letter must be unique.', this.author.id))).content.toLowerCase();
        msg.delete();
    }
    async editImage() {
        await this.updateDM('**Image**: What image would you like to provide? You can either embed an image or provide an image link. If your input is neither, you will have no image. Type cancel to cancel');
        const imageMsg = await this.channel.then(c => c.next(null, null, this.author.id));
        const attachments = (imageMsg).attachments;
        this.data.reqsImageUrl = '';
        if (attachments && attachments.size)
            this.data.reqsImageUrl = attachments.first().proxyURL;
        else if (isValidHttpUrl(imageMsg.content))
            this.data.reqsImageUrl = imageMsg.content;
    }
    async editSplitGroup() {
        await this.updateDM('**Split Group**: Should this start a split group run?');
        this.data.isSplit = await this.dm.then(d => d.confirm(this.author.id));
    }
    async editNewChannel() {
        await this.updateDM('**New Channel**: Should this run create a new channel?');
        this.data.newChannel = await this.dm.then(d => d.confirm(this.author.id));
        this.data.postAfkCheck = !this.data.newChannel;
    }
    async editVialReact() {
        await this.updateDM('**Vial React**: Should this provide a vial react?');
        this.data.vialReact = await this.dm.then(d => d.confirm(this.author.id));
    }
    async editTwoPhase() {
        await this.updateDM('**Locked Phase**: Should there be a locked phase before unlocking VC?');
        this.data.twoPhase = await this.dm.then(d => d.confirm(this.author.id));
    }
    async editVCCap() {
        await this.updateDM('**VC Cap**: How many users should the Voice Channel be capped to? This is limited to 99. Type cancel to cancel');
        this.data.vcCap = await this.channel.then(c => c.nextInt(res => res > 0 && res < 100, 'Please enter a number between 1 and 99.', this.author.id));
    }
    async editTimeLimit() {
        await this.updateDM('**AFK Time Limit**: How long should the afk time limit, in the format #min #sec? Type cancel to cancel');
        let time;
        await this.channel.then(c => c.next(res => !!(time = timeFromTimeStr(res.content)) && time.total, 'Please enter in the format #min #sec.', this.author.id));
        this.data.timeLimit = time.total;
    }
    async editKeyCount() {
        await this.updateDM('**Key Count**: How many key reacts should be accepted? Type cancel to cancel');
        this.data.keyCount = await this.channel.then(c => c.nextInt(res => res > 0, 'Please enter a number of keys that\'s at least 1.', this.author.id));
    }
    async editPingRole() {
        await this.updateDM(`**Ping Role**: Should this afk ping ${this.guild.roles.resolve(guildSettings[this.guild.id].roles.voidping)} or ${this.guild.roles.resolve(guildSettings[this.guild.id].roles.cultping)}?`);
        this.data.pingRole = await new Promise(async (resolve, reject) => {
            const collector = await this.dm.then(d => d.createReactionCollector((reaction, user) => user.id == this.author.id &&
                (reaction.emoji.name == '❌' || [botSettings.emoteIDs.voidd,
                botSettings.emoteIDs.malus
                ].includes(reaction.emoji.id)), { time: ext.MAX_WAIT }));
            let resolved = false;
            new Promise(async () => {
                await this.dm.then(d => d.react(botSettings.emote.voidd));
                await this.dm.then(d => d.react(botSettings.emote.malus));
                await this.dm.then(d => d.react('❌'));
            })
            collector.once('collect', async (reaction) => {
                resolved = true;
                collector.stop();
                await this.dm.then(d => d.reactions.removeAll());
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
                    reject('Ping role selection timed out.');
            });
        });
    }
    async editEmbedColor() {
        await this.updateDM('**Embed Color**: What color should the embed be? Please give a hex color code in the form `#123abc`. Type cancel to cancel');
        this.data.embed.color = (await this.channel.then(c => c.next(({ content }) => /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(content), 'Please give a hex color code in the form `#123abc`.', this.author.id))).content;
    }
    async editFontColor() {
        await this.updateDM('**Font Color**: What color should the font be? Please give a hex color code in the form `#123abc`. Type cancel to cancel');
        this.data['font-color'] = (await this.channel.then(c => c.next(({ content }) => /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(content), 'Please give a hex color code in the form `#123abc`.', this.author.id))).content;
    }
    async editDescription() {
        await this.updateDM('**Description**: What description would you like for your afk check? Type cancel to cancel');
        this.data.embed.description = (await this.channel.then(c => c.next(null, null, this.author.id))).content;
    }
    async editEarlyReacts() {
        this.updateReacts(`React to this message with all early reactions. ${this.bot.emojis.resolve(this.data.keyEmoteID)} ${this.data.vialReact ? 'and <' + botSettings.emote.Vial + '> are' : 'is'} automatically added. Any not accessible by me will be removed. React to the ❌ to finish adding reactions.`);

        const earlyReacts = (await this.rm.then(r => r.getReactionBatch(this.author.id))).slice(0, 23);
        for (const emoji of earlyReacts) {
            const reaction = { emoteID: emoji.id, pointsGiven: 0 };
            await this.rm.then(r => r.edit(this.reactEmbed.setDescription(`${emoji}: **How many people should get early location?**`)));
            reaction.limit = await this.channel.then(c => c.nextInt(res => res > 0, 'Please enter a number equal to or greater than 1.', this.author.id));

            this.rm.then(r => r.edit(this.reactEmbed.setDescription(`${emoji}: **What is the short name of the react?** No space allowed.`)));
            reaction.shortName = (await this.channel.then(c => c.next(res => !/\s/.test(res), 'Please enter a value without spaces.', this.author.id))).content.toLowerCase();

            await this.rm.then(r => r.edit(this.reactEmbed.setDescription(`${emoji}: **Does this emoji have a required role?**`)));
            if (await this.rm.then(r => r.confirm(this.author.id)))
                reaction.requiredRole = await this.getRoleSelection();

            this.data.earlyLocationReacts.push(reaction);
        }
    }
    async editReacts() {
        this.updateReacts(`React to this message with all non-early reactions. Any not accessible by me will be removed. React to the ❌ to finish adding reactions.`);
        this.data.reacts = (await this.rm.then(r => r.getReactionBatch(this.author.id))).map(c => c.id);
    }
    async getRoleSelection() {
        return new Promise(async (resolve, reject) => {
            let rolesMessage;
            const guildRoles = guildSettings[this.guild.id].roles;
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

                    const role = this.original.guild.roles.resolve(guildRoles[rolename]);
                    if (!role)
                        continue;

                    selections.push(rolename);
                    roleList.push(`\r\n${selections.length} ${role}`);
                    if (roleList.length == 5) {
                        rolesEmbed.addField('** **', `**${roleList.join('\r\n')}**`, true)
                        roleList = [];
                    }
                }

                if (roleList.length)
                    rolesEmbed.addField('** **', `**${roleList.join('\r\n')}**`, true)

                rolesMessage = await (await this.channel).send(rolesEmbed);
                const selection_idx = await this.channel.then(c => c.nextInt(res => res >= 0 && res <= selections.length, `Please enter a value between 0 and ${selections.length}. Enter 0 for no role.`, this.author.id));
                rolesMessage.delete();
                resolve(selection_idx == 0 ? null : selections[selection_idx - 1]);
            } catch (err) {
                if (rolesMessage) rolesMessage.delete();
                reject(err);
            }
        });
    }

    async requestReactions() {

    }

    save() {
        return new Promise((resolve, reject) => {
            if (!afkTemplates[this.author.id])
                afkTemplates[this.author.id] = {};
            afkTemplates[this.author.id][this.symbol] = this.data;
            fs.writeFile(require.resolve('../afkTemplates.json'), JSON.stringify(afkTemplates, null, 4), (err) => {
                if (err) {
                    reject(err);
                }
                if (this.brandnew) {
                    this.brandnew = false;
                }

                resolve(this);
            });
        });
    }
    edit() {

    }
}

AfkTemplate.active = [];
module.exports = {
    name: 'createtemplate',
    description: 'Create a new AFK template',
    alias: ['ct', 'createt'],
    args: '',
    role: 'vetrl',
    checkActive: (id) => AfkTemplate.active.find(t => t.author === id),
    /**
     * Main Execution Function
     * @param {Discord.Message} message 
     * @param {String[]} args 
     * @param {Discord.Client} bot 
     * @param {import('mysql').Connection} db 
     * @param {import('mysql').Connection} tokenDB 
     */
    async execute(message, args, bot, db, tokenDB, event) {
        //Must start it in vet commands
        if (message.channel.id != guildSettings[message.guild.id].channels.vetcommands) return;

        if (AfkTemplate.active.find(t => t.author.id == message.author.id))
            return message.channel.send('You are already in the process of creating a raiding template.');

        message.delete();
        const afk_template = new AfkTemplate(message, bot);
        AfkTemplate.active.push(afk_template);
        try {

            await afk_template.build();
            await afk_template.editRunType();
            await afk_template.editRunName();
            await afk_template.editSymbol();
            await afk_template.editImage();
            await afk_template.editPingRole();
            await afk_template.editSplitGroup();
            await afk_template.editNewChannel();
            await afk_template.editVialReact();
            await afk_template.editTwoPhase();
            await afk_template.editVCCap();
            await afk_template.editTimeLimit();
            await afk_template.editKeyCount();
            await afk_template.editEmbedColor();
            await afk_template.editFontColor();
            await afk_template.editDescription();
            await afk_template.updateDM();
            await afk_template.editEarlyReacts();
            await afk_template.editReacts();
            await afk_template.updateReacts();
            let emoji;
            do {
                //afk_template.updateDM(`Are you sure you want to create this template? React with ✅ to confirm, ⚙️ to edit, or ❌ to cancel.`);
                afk_template.updateDM(`Are you sure you want to create this template? React with ✅ to confirm or ❌ to cancel.`);

                emoji = await new Promise(async (resolve, reject) => {
                    const dm = await afk_template.dm;
                    new Promise(async () => {
                        await dm.react('✅');
                        // await dm.react('⚙️');
                        await dm.react('❌');
                    })
                    const collector = dm.createReactionCollector((reaction, user) => user.id == afk_template.author.id && ['✅', '⚙️', '❌'].includes(reaction.emoji.name), { time: ext.MAX_WAIT });
                    let resolved = false;
                    collector.once('collect', (reaction, user) => {
                        resolved = true;
                        resolve(reaction.emoji.name);
                    });
                    collector.once('end', () => {
                        if (!resolved)
                            reject('timed out');
                    })
                });

                switch (emoji) {
                    case '✅':
                        await afk_template.save();
                        afk_template.embed.setTitle("Successfully Created Raiding Template")
                            .setColor("#00ff00")
                            .setDescription("Successfully created the following raiding template:")
                            .setFooter(`UID: ${message.author.id} • ;afk ${afk_template.symbol} • Created at`)
                            .setTimestamp(new Date());
                        afk_template.reactEmbed.setColor("#00ff00");
                        message.author.send(afk_template.embed).then(() => message.author.send(afk_template.reactEmbed))
                        bot.channels.resolve(guildSettings[message.guild.id].channels.history).send(afk_template.embed).then(m => m.channel.send(afk_template.reactEmbed));
                        break;
                    case '⚙️':
                        //await afk_template.edit();
                        afk_template.channel.then(ch => ch.send("This isn't supported yet, how do you know to react with it!!?!"));
                        break;
                    case '❌':
                        throw 'Manually cancelled.';
                }
            } while (emoji === '⚙️');
            Array.remove(AfkTemplate.active, afk => afk == afk_template);
            if (afk_template.channel.id !== message.channel.id)
                afk_template.channel.then(c => c.delete());
        } catch (error) {
            Array.remove(AfkTemplate.active, t => t.author.id == message.author.id);
            if (message.channel.id !== afk_template.channel.then(c => c.id))
                afk_template.channel.then(c => c.delete());

            afk_template.embed.setTitle('Raiding Template Cancelled')
                .setColor('#ff0000')
                .setDescription(error.stack || error)
                .setFooter(`UID: ${message.author.id} • Cancelled at`)
                .setTimestamp(new Date());
            message.author.send(afk_template.embed).then(async () => {
                if (afk_template.reactEmbed) {
                    const dm = await afk_template.dm.then(d => d);
                    afk_template.reactEmbed.setColor('#ff0000')
                        .setFooter(`TID: ${dm.id} • Cancelled at`)
                        .setTimestamp(new Date())
                        .setTitle('Raiding Template Cancelled');
                    message.author.send(afk_template.reactEmbed);
                }
            })
        }
    }
};