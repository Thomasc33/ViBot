const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('@discordjs/builders')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const ranks = {
    'HIGHER' : 'Higher',
    'HIGHEST' : 'Highest'
}

const PageConfigurations = {
    'NEITHER' : 0,
    'HIGHER_ONLY' : 1,
    'HIGHEST_ONLY' : 2,
    'BOTH' : 3
}

const Buttons = {
    'FIRST' : 'FIRST',
    'PREVIOUS' : 'PREVIOUS',
    'SWITCH_RANK' : 'SWITCH_RANK',
    'NEXT' : 'NEXT',
    'LAST' : 'LAST',
    'DROPDOWN' : 'DROPDOWN'
}

module.exports = {
    name: 'list',
    description: 'Displays a list of all users with the specified role.',
    role: 'security',
    args: '<role name/ID>',
    requiredArgs: 1,
    alias: ['roleinfo', 'ri'],
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     */
    async execute(message, args, bot) {
        let exportFile = args[args.length - 1].toLowerCase() == 'export';
        if (exportFile) args = args.slice(0, args.length - 1);
        console.log(args);
        let roles = args.join(' ').toLowerCase().split('|');
        for (let i in roles) { roles[i] = roles[i].trim(); }
        // handle export still in roles
        if (roles.length == 1) { 
            if (exportFile) {
                module.exports.exportFileSingle(message, args, bot, roles[0]);
            } else {
                module.exports.normalList(message, args, bot, roles[0]);
            }
        } else if (exportFile) {
            module.exports.exportFileMultiple(message, args, bot, roles);
        } else module.exports.combinedList(message, args, bot, roles);
    },

    async exportFileSingle (message, args, bot, role) {
        let guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)	
        const d = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id) }
        let highestCSV = ''
        for (const member of d.highest) {
            highestCSV = highestCSV + member + ','
        }
        let highestFile = Buffer.from(highestCSV.slice(0, -1), 'utf-8');

        let higherCSV = ''
        for (const member of d.higher) {
            higherCSV = higherCSV + member + ','
        }
        let higherFile = Buffer.from(higherCSV.slice(0, -1), 'utf-8');
        message.channel.send({
            files: [{
                attachment: highestFile,
                name: role + '-as-highest-role'
            },
            {
                attachment: higherFile,
                name: 'has-higher-role-than-' + role
            }],
        });
    },

    async normalList(message, args, bot, role) {
        // const existingEmbed = message.client.activeEmbeds.get(message.author.id);

        // // If an active embed exists, close it
        // if (existingEmbed) {
        //     try {
        //         await existingEmbed.message.edit({ components: [] });
        //     } catch (error) {
        //         console.error('Error closing active embed:', error);
        //     }
        // }
        // Search for role in guild
        let guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)	
        const memberList = message.guild.roles.cache.get(guildRole.id).members.map(member => member);	
        const d = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id) }
        // FOR TESTING
        // d.higher = d.higher + d.higher + d.higher;
        // d.highest = d.highest + d.highest + d.highest;


        // List of users where given role is highest position
        let highestString = '';
        let highestStringPages = [];
        for (const member of d.highest) {
            if (highestString.length < 950) {
                highestString += `${member} `;
                if (member == d.highest[d.highest.length - 1]) {
                    highestStringPages.push(highestString);
                }
            }
            else {
                highestStringPages.push(highestString);
                highestString = '';
            }
        }
        // List of users with a higher position role
        let higherString = '';
        let higherStringPages = [];
        for (const member of d.higher) {
            if (higherString.length < 950) {
                higherString += `${member} `;
                if (member == d.higher[d.higher.length - 1]) higherStringPages.push(higherString); 
            } 
            else {
                higherStringPages.push(higherString);
                higherString = '';
            }
        }

        const pagesDict = {
            'Higher' : higherStringPages,
            'Highest' : highestStringPages
        };

        // setting starting page
        let pageConfig = PageConfigurations['NEITHER']
        if (d.highest.length > 0) {
            if (d.higher.length > 0) pageConfig = PageConfigurations['BOTH'];
            else pageConfig = PageConfigurations['HIGHEST_ONLY'];
        }
        else if (d.higher.length > 0) pageConfig = PageConfigurations['HIGHER_ONLY'];

        let lastRank = pageConfig == PageConfigurations['HIGHER_ONLY'] ? ranks['HIGHER'] : ranks['HIGHEST'];

        // info to send to embed creator
        const embedInfo = {pageConfig: pageConfig, higherStringPages: higherStringPages, highestStringPages: highestStringPages, d: d, memberList: memberList, guildRole: guildRole}
        let currentPage = 0;
        const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000 })
        navigationInteractionHandler.on('collect', async interaction => {
            if (interaction.user.id != message.author.id) return
            if (interaction.customId == Buttons['SWITCH_RANK']) {
                currentPage = 0;
                lastRank = this.getOppositeRank(lastRank);
            } else if (interaction.customId == Buttons['NEXT']) {
                currentPage++;
            } else if (interaction.customId == Buttons['PREVIOUS']) {
                currentPage--;
            } else if (interaction.customId == Buttons['LAST']) {
                currentPage = pagesDict[lastRank].length - 1;
            } else if (interaction.customId == Buttons['FIRST']) {
                currentPage = 0;
            } else if (interaction.customId == Buttons['DROPDOWN']) {
                currentPage = parseInt(interaction.values[0]);
            }
            if (interaction.customId in Buttons) await interaction.update({ embeds: [this.createEmbed(embedInfo, currentPage, lastRank)], components: this.createComponents(currentPage, pagesDict[lastRank].length, pageConfig, this.getOppositeRank(lastRank)) })
        })
        navigationInteractionHandler.on('end', async () => {
            await message.edit({ components: [] })
        })
        
        const row = this.createComponents(0, pagesDict[lastRank].length, pageConfig, this.getOppositeRank(lastRank));
        message.channel.send({ embeds: [this.createEmbed(embedInfo, 0, lastRank)], components: row }).catch(err => ErrorLogger.log(err, bot, message.guild));
    },

    createComponents(pageNumber, pages, pageConfig=PageConfigurations['NEITHER'], rank=ranks['HIGHEST'] ) {
        let rowBuilder = new Discord.ActionRowBuilder();
        let dropdownRow = new Discord.ActionRowBuilder();

        if (pages > 1) {
            // first page
            let first = new Discord.ButtonBuilder()
                .setEmoji('⏮️')
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons['FIRST'])
            if (pageNumber == 0) {
                first.setDisabled(true);
            }
            // rowBuilder.addComponents([first]);

            // previous page
            let previous = new Discord.ButtonBuilder()
                .setEmoji('⬅️')
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons['PREVIOUS'])
            if (pageNumber == 0) {
                previous.setDisabled(true);
            }
            // rowBuilder.addComponents([previous]);
        }
        // higher vs highest button
        if (pageConfig == PageConfigurations['BOTH']) {
            let rankButton = new Discord.ButtonBuilder()
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons['SWITCH_RANK']);
                if (rank == ranks['HIGHER']) { 
                    rankButton.setLabel('Users with a higher role')
                    rankButton.setEmoji('⬆️');
                }
                else { 
                    rankButton.setLabel('Users with no higher role')
                    rankButton.setEmoji('➖');
                }
            
            rowBuilder.addComponents([rankButton])
        }
        if (pages > 1) {
            // next page
            let next = new Discord.ButtonBuilder()
                .setEmoji('➡️')
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons['NEXT'])
            if (pageNumber >= pages - 1 ) {
                next.setDisabled(true);
            }
            // rowBuilder.addComponents([next]);

            // last page
            let last = new Discord.ButtonBuilder()
                .setEmoji('⏭️')
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons['LAST'])
            if (pageNumber >= pages - 1 ) {
                last.setDisabled(true);
            }
            // rowBuilder.addComponents([last]);
            
            // dropdown
            let dropdown = new StringSelectMenuBuilder({
                custom_id: Buttons['DROPDOWN'],
                placeholder: 'Page: ' + (pageNumber + 1),
            });

            // pages before currentPage
            for (let i = Math.max(0, pageNumber - 10); i < pageNumber; i++) {
                dropdown.addOptions(new StringSelectMenuOptionBuilder()
					.setLabel(i + 1 + '')
					.setValue(i + ''));
            }
            
            // pages after currentPage
            for (let i = pageNumber; i < Math.min(pageNumber + 11, pages); i++) {
                let option = new StringSelectMenuOptionBuilder()
                .setLabel(i + 1 + '')
                .setValue(i + '');
                if (i == pageNumber) option.setDefault(true);
                dropdown.addOptions(option);
            }
            dropdownRow.addComponents(dropdown);
        }
        let rows = [];
        if (rowBuilder.components.length > 0) rows.push(rowBuilder);
        if (dropdownRow.components.length > 0) rows.push(dropdownRow);
        return rows;
    },
    
    createEmbed(embedInfo, pageNumber, rank) {
        console.log(embedInfo.d.highest.length + embedInfo.d.higher.length);
        const pages = rank == ranks['HIGHER'] ? embedInfo.higherStringPages.length : embedInfo.highestStringPages.length;
        const embed = new Discord.EmbedBuilder()
        .setColor(embedInfo.guildRole.hexColor)
        .setTitle(`Role Info for ${embedInfo.guildRole.name}`)
        .setDescription(`**Role:** ${embedInfo.guildRole} | **Role Color:** \`${embedInfo.guildRole.hexColor}\` | Page ${pageNumber + 1} of ${pages}`)
        .setFooter({ text: `There are ${embedInfo.memberList.length} members in the ${embedInfo.guildRole.name} role` })
        .setTimestamp();
        if (rank == ranks['HIGHEST']) {
            embed.addFields(
                { name: `${embedInfo.d.highest.length} members with \`${embedInfo.guildRole.name}\` as their highest role`, value: embedInfo.d.highest.length > 0 ? embedInfo.highestStringPages[pageNumber] : 'None' })
        }
        else {
            embed.addFields(
                { name: `${embedInfo.d.higher.length} members with a higher role than \`${embedInfo.guildRole.name}\``, value: embedInfo.d.higher.length > 0 ? embedInfo.higherStringPages[pageNumber] : 'None' })
        }
        return embed
    },

    getOppositeRank(rank) {
        return rank == ranks['HIGHER'] ? ranks['HIGHEST'] : ranks['HIGHER'];
    },

    async combinedList(message, args, bot, roles) {
        roles = roles.map(role => message.guild.findRole(role))
        var roleObjects = {}
        for (let i in roles) {
            roleObjects[roles[i]] = message.guild.findUsersWithRole(roles[i].id).map(member => member.id)
        }
        var memberList = Object.values(roleObjects).reduce((acc, array) => {
            return acc.filter(id => array.includes(id));
        });
        // FOR TESTING
        memberList = memberList+memberList+memberList+memberList;
        let memberString = '';
        let memberStringPages = []
        for (const member of memberList) {
            if (memberString.length < 950) {
                memberString += `<@!${member}> `;
                if (member == memberList[memberList.length - 1]) {
                    memberStringPages.push(memberString);
                }
            }
            else {
                memberStringPages.push(memberString);
                memberString = '';
            }
        }

        let currentPage = 0;
        let embed = new Discord.EmbedBuilder()
                .setTitle('Combined List')
                .setDescription(`**Roles: ${roles.map(role => role).join(' | ')}** | Page ${currentPage + 1} of ${memberStringPages.length}`)
                .setColor(roles[0].hexColor)
            embed.addFields({
                name: 'These users have all of the roles combined',
                value: memberStringPages[currentPage]
            })
            embed.setFooter({ text: `There are ${memberList.length} users who have all of the roles combined` })
        const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000 })
        navigationInteractionHandler.on('collect', async interaction => {
            if (interaction.user.id != message.author.id) return
            if (interaction.customId == Buttons['NEXT']) {
                currentPage++;
            } else if (interaction.customId == Buttons['PREVIOUS']) {
                currentPage--;
            } else if (interaction.customId == Buttons['LAST']) {
                currentPage = memberStringPages.length - 1;
            } else if (interaction.customId == Buttons['FIRST']) {
                currentPage = 0;
            } else if (interaction.customId == Buttons['DROPDOWN']) {
                currentPage = parseInt(interaction.values[0]);
            }
            embed = new Discord.EmbedBuilder()
                .setTitle('Combined List')
                .setDescription(`**Roles: ${roles.map(role => role).join(' | ')}** | Page ${currentPage + 1} of ${memberStringPages.length}`)
                .setColor(roles[0].hexColor)
            embed.addFields({
                name: 'These users have all of the roles combined',
                value: memberStringPages[currentPage]
            })
            if (interaction.customId in Buttons) await interaction.update({ embeds: [embed], components: this.createComponents(currentPage, memberStringPages.length) })
        })
        navigationInteractionHandler.on('end', async () => {
            await message.edit({ components: [] })
        })
        
        const row = this.createComponents(0, memberStringPages.length);
        message.channel.send({ embeds: [embed], components: row }).catch(err => ErrorLogger.log(err, bot, message.guild));


    }
}