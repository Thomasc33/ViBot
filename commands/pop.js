const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const keypops = require('../data/keypop.json');
const keyroles = require('../data/keyRoles.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js');
const { createReactionRow } = require('../redis.js');
const { settings } = require('../lib/settings');
module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    getNotes(guild) {
        return keypops[guild.id] ? Object.keys(keypops[guild.id]).toString() : `not setup for guild ${guild.id}`;
    },
    requiredArgs: 2,
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.String, 'keytype', {
            description: 'The type of key to pop'
        }),
        slashArg(SlashArgType.User, 'user', {
            description: 'The key popper'
        }),
        slashArg(SlashArgType.Integer, 'count', {
            required: false,
            description: 'The number of keys to add (default 1)'
        }),
    ],
    getSlashCommandData(guild) {
        const json = slashCommandJSON(this, guild);
        if (keypops[guild.id]) json[0].options[0].choices = slashChoices(Object.keys(keypops[guild.id]));
        return json;
    },
    async execute(message, args) {
        // Initialize
        let count = 1;
        if (args.length < 1) return;
        if (args.length > 2) count = parseInt(args[2]);
        if (isNaN(count) || !count) count = 1;
        const member = message.guild.findMember(args[1]);
        if (!member) return message.reply('Could not find a member.');

        // Validate Command Arguments
        if (!keypops[message.guild.id]) return message.replyUserError('Key information missing for this guild');
        const keyInfo = module.exports.findKey(message.guild.id, args[0].toLowerCase());
        if (!keyInfo) return message.replyUserError(`\`${args[0]}\` not recognized`);

        // Create Discord Embed Confirmation
        const confirmEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`Are you sure you want to log \`\`${count}\`\` **${keyInfo.name}** pops for ${member.nickname}?\n\nPlease select which key.`);

        // add buttons initialized with regular key button
        const buttons = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('Regular Key')
                    .setLabel('Regular Key')
                    .setStyle(Discord.ButtonStyle.Primary)
            );

        // only add modded button if the key is able to be modded
        if (keyInfo.modded) {
            buttons.addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('Modded Key')
                    .setLabel('Modded Key')
                    .setStyle(Discord.ButtonStyle.Primary)
            );
        }

        // add cancel button to the end
        buttons.addComponents(
            new Discord.ButtonBuilder()
                .setCustomId('Cancelled')
                .setLabel('❌ Cancel')
                .setStyle(Discord.ButtonStyle.Danger)
        );

        const reply = await message.reply({ embeds: [confirmEmbed], components: [buttons], ephemeral: true });
        createReactionRow(reply, module.exports.name, 'handleButtons', buttons, message.author, { memberId: member.id, keyInfo, count });
    },
    async handleButtons(bot, confirmMessage, db, choice, state) {
        const member = confirmMessage.interaction.guild.members.cache.get(state.memberId);
        const { count, keyInfo } = state;
        const { guild } = confirmMessage.interaction;
        let moddedKey = false;
        if (!choice || choice == 'Cancelled') return confirmMessage.delete();
        if (choice == 'Modded Key') moddedKey = true;

        // Execute Database Query
        db.query('SELECT * FROM users WHERE id = ?', [member.id], async (err, rows) => {
            if (err) ErrorLogger.log(err, bot);
            if (rows.length == 0) {
                const success = await new Promise((res) => {
                    db.query('INSERT INTO users (id) VALUES (?)', [member.id], (err, rows) => {
                        if (err || !rows || rows.length == 0) {
                            confirmMessage.interaction.reply({
                                embeds: [
                                    new Discord.EmbedBuilder().setDescription(`Unable to add <@!${member.id}> to the database.`).addFields([{ name: 'Error', value: `${err || 'Unknown reason'}` }])
                                ],
                                ephemeral: true
                            });
                            res(false);
                        } else res(true);
                    });
                });
                if (!success) return;
            }
            const consumablepops = {
                userid: member.id,
                guildid: guild.id,
                unixtimestamp: Date.now(),
                amount: count,
                ismodded: moddedKey,
                templateid: keyInfo.templateID
            };
            db.query('INSERT INTO consumablepops SET ?', consumablepops, err => {
                if (err) throw err;
                if (err) return console.log(`${keyInfo.schema} missing from ${guild.name} ${guild.id}`);
            });
            db.query('UPDATE users SET ?? = ?? + ? WHERE id = ?', [keyInfo.schema, keyInfo.schema, count, member.id], err => {
                if (err) throw err;
                checkUser(member, bot, db);
            });
            if (moddedKey) {
                db.query('UPDATE users SET ?? = ?? + ? WHERE id = ?', [keyInfo.moddedSchema, keyInfo.moddedSchema, count, member.id], err => {
                    if (err) throw err;
                    checkUser(member, bot, db);
                });
            }
            const embed = new Discord.EmbedBuilder()
                .setColor('#0000ff')
                .setTitle('Key logged!')
                .setDescription(`${member} now has \`\`${parseInt(rows[0][keyInfo.schema]) + parseInt(count)}\`\` ${keyInfo.name} pops`);
            confirmMessage.interaction.channel.send({ embeds: [embed] });
        });

        const { backend, points: pointsSettings, lists, roles } = settings[confirmMessage.interaction.guild.id];
        // Add Points to Database
        if (backend.points && keyInfo.points) {
            let points = pointsSettings[keyInfo.points] * count;
            if (member.roles.cache.hasAny(...lists.perkRoles.map(role => roles[role]))) points *= pointsSettings.supportermultiplier;
            if (moddedKey) points *= pointsSettings.keymultiplier;
            db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, member.id]);
        }
        // Delete Confirmation Message
        return confirmMessage.delete();
    },
    findKey(guildid, key) {
        const info = keypops[guildid];
        if (Object.keys(info).includes(key)) return info[key];
        for (const i of Object.keys(info)) {
            if (info[i].alias.includes(key)) return info[i];
            if (info[i].schema.toLowerCase() == (key.toLowerCase())) return info[i];
        }
        return null;
    }
};

async function checkUser(member, bot, db) {
    const popInfo = keyroles[member.guild.id];
    if (!popInfo) return;
    const rows = [...new Set(popInfo.map(ki => ki.types.map(t => t[0])).flat())];
    db.query('SELECT id, ?? FROM users WHERE id = ?', [rows, member.id], async (err, rows) => {
        if (err) ErrorLogger.log(err, bot, member.guild);
        if (!rows || !rows[0]) return db.query('INSERT INTO users (id) VALUES (?)', [member.id]);
        await checkRow(member.guild, rows[0], member);
    });
}

async function checkRow(guild, row, member) {
    const { roles } = settings[guild.id];
    const popInfo = keyroles[guild.id];
    if (!roles || !popInfo || !member) return;
    member = member || await guild.members.fetch(row.id).catch();
    const rolesToAdd = [];
    for (const keyInfo of popInfo) {
        if (!roles[keyInfo.role]) continue;
        let count = 0;
        for (const [keyType,] of keyInfo.types) count += row[keyType] || 0;
        console.log(count, keyInfo.amount, member.roles.cache.has(roles[keyInfo.role]));
        if (count >= keyInfo.amount) {
            if (!member.roles.cache.has(roles[keyInfo.role])) rolesToAdd.push(roles[keyInfo.role]);
        }
    }
    await member.roles.add(rolesToAdd);
}
