const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js');
const { settings } = require('../lib/settings');

//add this to settings eventually:registered:
const reacts = require('../data/roleAssignment.json')

module.exports = {
    addInteractionButtons,
    name: 'roleassignment',
    args: 'send/init',
    role: 'moderator',
    async execute(message, args, bot, db) {
        if (!settings[message.guild.id].backend.roleassignment) return message.channel.send('roleassignment has been turned off in this server');

        let guildReacts = reacts[message.guild.id]
        if (!guildReacts) return message.channel.send('Reactions not setup for this guild')

        //make embed
        let embed = getEmbed(guildReacts)

        //get channel
        let channel = message.guild.channels.cache.get(settings[message.guild.id].channels.roleassignment)
        if (!channel) return message.channel.send('Could not find channel: ' + settings[message.guild.id].channels.roleassignment)

        //get arg
        if (args.length == 0) return message.channel.send('Inavlid arguements: ``;roleassignment <send/init>``')
        switch (args[0].toLowerCase()) {
            case 'send':

                let message = await channel.send({ embeds: [embed] })

                setTimeout(async () => {
                    await addInteractionButtons(message, bot)
                }, 1000);

                break;
        }
    }
}

async function addInteractionButtons(message, bot) {
    if (!settings[message.guild.id].backend.roleassignment) return;
    let guildReacts = reacts[message.guild.id]
    if (!guildReacts) return
    
    const giveAllRolesButton = new Discord.ButtonBuilder()
        .setCustomId('giveAllRoles')
        .setLabel('✅ Give All')
        .setStyle(3);
    const takeAllRolesButton = new Discord.ButtonBuilder()
        .setCustomId('takeAllRoles')
        .setLabel('❌ Take All')
        .setStyle(4);

    let buttons = [];
    buttons.push(giveAllRolesButton)
    const actionRows = new Array;
    for (let i in guildReacts) {
        reaction = guildReacts[i]
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(reaction.emojiId)
            .setEmoji(reaction.emojiId)
            .setStyle(Discord.ButtonStyle.Secondary);
        buttons.push(buttonToAdd);
        if (buttons.length >= 5) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(takeAllRolesButton));
    } else {
        buttons.push(takeAllRolesButton)
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    
    message = await message.edit({ components: actionRows })
    roleAssignmentInteractionCollector = new Discord.InteractionCollector(bot, { message: message, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
    roleAssignmentInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, bot))
}

async function interactionHandler(interaction, bot) {
    if (!settings[interaction.guild.id].backend.roleassignment) return;
    if (!interaction.isButton()) return;

    failedEmbed = new Discord.EmbedBuilder()
        .setColor('#FF0000')
        .setDescription(`Something went wrong, please try again or contact any Head Raid Leader+ to fix this`)
        .setFooter({ text: `${interaction.customId}` })

    const { roles } = settings[interaction.guild.id]
    let guildReacts = reacts[interaction.guild.id]
    if (!guildReacts) return await interaction.reply({ embeds: [failedEmbed], ephemeral: true })

    if (interaction.customId === "giveAllRoles") {
        for (let i in guildReacts) {
            reaction = guildReacts[i]
            role = interaction.guild.roles.cache.get(roles[reaction.role])
            if (!interaction.member.roles.cache.has(role.id)) {
                // The user does not have the reactable role, and therefor we will add it
                interaction.member.roles.add(role)
            }
        }
        await interaction.reply({ content: `You now have ${guildReacts.map(role => interaction.guild.roles.cache.get(roles[role.role])).join(', ')}\nand will recieve pings for ${guildReacts.map(name => name.name).join(', ')}`, ephemeral: true })
    }
    else if (interaction.customId === "takeAllRoles") {
        for (let i in guildReacts) {
            reaction = guildReacts[i]
            role = interaction.guild.roles.cache.get(roles[reaction.role])
            if (interaction.member.roles.cache.has(role.id)) {
                // The user has the reactable role, and therefor we will remove it
                interaction.member.roles.remove(role)
            }
        }
        await interaction.reply({ content: `You no longer have ${guildReacts.map(role => interaction.guild.roles.cache.get(roles[role.role])).join(', ')}\nand will not recieve pings for ${guildReacts.map(name => name.name).join(', ')}`, ephemeral: true })
    }
    else {
        for (let i in guildReacts) {
            reaction = guildReacts[i]
            if (interaction.customId === reaction.emojiId) {
                role = interaction.guild.roles.cache.get(roles[reaction.role])

                if (interaction.member.roles.cache.has(role.id)) {
                    // The user has the reactable role, and therefor we will remove it
                    interaction.member.roles.remove(role)
                    await interaction.reply({ content: `You no longer have ${role} and will no longer recieve pings for ${reaction.name}`, ephemeral: true })
                } else {
                    // The user does not have the reactable role, and therefor we will add it
                    interaction.member.roles.add(role)
                    await interaction.reply({ content: `You now have ${role} and will recieve pings for ${reaction.name}`, ephemeral: true })
                }
            }
        }
    }
}

function getEmbed(guildReacts) {
    let embed = new Discord.EmbedBuilder()
        .setTitle('Assign Roles')
        .setColor('#6fa8dc')
        .setDescription('Press the buttons with one of the following emojis to get pinged for specific runs\nCan be disabled by pressing the same button after recieving your role')
    for (let i of guildReacts) {
        embed.addFields([{name: i.name, value: i.emoji, inline: true}])
    }
    return embed
}