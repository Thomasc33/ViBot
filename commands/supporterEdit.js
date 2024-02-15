const { InteractionCollector, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ActionRowBuilder } = require('@discordjs/builders');

const userDict = {
    ALL_SUPPORTERS: 'allSupporters',
    INDIVIDUAL: 'individual'
};

module.exports = {
    name: 'supporteredit',
    description: 'Edits supporter usage',
    alias: ['editsupporter'],
    role: 'headeventrl',
    args: [],
    guildSpecific: true,
    async execute(message, args, bot, db) {
        const botSettings = bot.settings[message.guild.id];

        const embed = new EmbedBuilder()
            .setTitle('Edit Supported Usage')
            .setColor('0099ff')
            .setDescription('Do you want to edit supporter usage for all supporters or an individual?');

        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(userDict.ALL_SUPPORTERS)
                    .setLabel('All Users')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(userDict.INDIVIDUAL)
                    .setLabel('Individual')
                    .setStyle(ButtonStyle.Secondary));

        const sendData = { embeds: [embed], components: [buttonRow] };
        const listMessage = await message.channel.send(sendData);
        const interactionHandler = new InteractionCollector(bot, { time: 60000, message: listMessage });
        let validated;
        interactionHandler.on('collect', async interaction => {
            if (interaction.user.id != message.author.id) return;
            if (interaction.customId === userDict.ALL_SUPPORTERS || interaction.customId === userDict.INDIVIDUAL) {
                await interaction.showModal(this.modalBuilder(message, interaction.customId));

                const filter = (interaction) => interaction.customId === `editSupporterUsage-${message.member}`;

                await interaction
                    .awaitModalSubmit({ filter, time: 30000 })
                    .then((modalInteraction) => {
                        const inputData = {
                            startTimeValue: modalInteraction.fields.getTextInputValue('startTimeInput'),
                            endTimeValue: modalInteraction.fields.getTextInputValue('endTimeInput'),
                            quantityValue: modalInteraction.fields.getTextInputValue('quantityOfTickets')
                        };
                        if (interaction.customId === userDict.INDIVIDUAL) {
                            inputData.usernameValue = modalInteraction.fields.getTextInputValue('usernameInput');
                        }
                        const validation = this.validateInput(message, botSettings, inputData);
                        if (validation.errors.length > 0) {
                            return modalInteraction.update({ embeds: [new EmbedBuilder().setTitle('Error(s)').setDescription(validation.errors.join(',\n')).setColor('Red')], components: [] });
                        }

                        validated = validation.validated;
                        const update = this.confirmationBuilder(validated);
                        return modalInteraction.update({ embeds: update.embed, components: update.row });
                    });
            }

            if (interaction.customId === 'cancelEdit') {
                return interaction.update({ embeds: [new EmbedBuilder().setTitle('Supporter Edit Usage Cancelled')], components: [] });
            }
            if (interaction.customId === 'confirmEdit') {
                const query = this.queryBuilder(validated);
                await db.promise().query(query.query, query.values).then((result) => {
                    if (!result || result[0].affectedRows === 0) {
                        return interaction.update({ embeds: [new EmbedBuilder().setTitle('No edits made. Contact a developer if this isn\'t what you expected').setColor('Red')], components: [] });
                    }
                    if (result[0].affectedRows) {
                        return interaction.update({ embeds: [new EmbedBuilder().setTitle(`Successfully edited ${result[0].affectedRows} supporter usage(s)!`).setColor('Green')], components: [] });
                    }
                });
            }
        });
    },

    modalBuilder(message, users) {
        const modal = new ModalBuilder({
            type: 1,
            customId: `editSupporterUsage-${message.member}`,
            title: 'Edit Supporter Usage'
        });

        const usernameInput = new TextInputBuilder({
            customId: 'usernameInput',
            label: 'Username',
            style: TextInputStyle.Short
        });

        const startTimeInput = new TextInputBuilder({
            customId: 'startTimeInput',
            label: 'Start Time (hours ago)',
            placeholder: 'Leave this and below blank to edit most recent ticket(s)',
            style: TextInputStyle.Short,
            required: false,
            max_length: 2
        });

        const endTimeInput = new TextInputBuilder({
            customId: 'endTimeInput',
            label: 'End Time (hours ago)',
            style: TextInputStyle.Short,
            placeholder: 'Leave blank for current time',
            required: false,
            max_length: 2
        });

        const quantityOfTickets = new TextInputBuilder({
            customId: 'quantityOfTickets',
            label: 'Quantity of Tickets',
            placeholder: 'Positive Number: Refund. Negative: Take Away',
            style: TextInputStyle.Short,
            max_length: 2
        });

        const usernameActionRow = new ActionRowBuilder().addComponents([usernameInput]);
        const startTimeActionRow = new ActionRowBuilder().addComponents([startTimeInput]);
        const endTimeActionRow = new ActionRowBuilder().addComponents([endTimeInput]);
        const quantityActionRow = new ActionRowBuilder().addComponents([quantityOfTickets]);

        if (users === userDict.INDIVIDUAL) { modal.addComponents(usernameActionRow); }
        modal.addComponents(startTimeActionRow, endTimeActionRow, quantityActionRow);
        return modal;
    },

    validateInput(message, botSettings, inputData) {
        const validation = {
            errors: [],
            validated: {}
        };
        // guildid
        validation.validated.guildid = message.guild.id;

        // username
        if (inputData.usernameValue) {
            const member = message.guild.findMember(inputData.usernameValue);
            const supporterRoles = botSettings.lists.perkRoles.map(role => message.guild.roles.cache.get(botSettings.roles[role]));
            if (!member || !member.roles.cache.hasAny(...supporterRoles.map(role => role?.id))) {
                validation.errors.push(`User: ${inputData.usernameValue} does not have any supporter roles`);
            } else {
                validation.validated.user = {
                    id: member.id,
                    username: inputData.usernameValue
                };
            }
        }

        // start time
        if (inputData.startTimeValue === '') {
            validation.validated.startTime = Date.now();
        } else if (!/^(0?|[1-9]|1\d|2[0-4])$/.test(inputData.startTimeValue.trim())) {
            validation.errors.push(`Start time: ${inputData.startTimeValue}, is not between 1-24`);
        } else {
            validation.validated.startTime = Date.now() - (parseInt(inputData.startTimeValue) * 60 * 60 * 1000);
        }

        // end time
        if (inputData.endTimeValue === '') {
            if (inputData.startTimeValue === '') {
                validation.validated.noTime = true;
            }
            validation.validated.endTime = Date.now();
        } else if (!/^(0?|[1-9]|1\d|2[0-4])$/.test(inputData.endTimeValue.trim())) {
            validation.errors.push(`End time: ${inputData.endTimeValue}, is not between 1-24`);
        } else {
            validation.validated.endTime = Date.now() - (parseInt(inputData.endTimeValue) * 60 * 60 * 1000);
        }

        // order times correctly if end < start
        if (validation.validated.endTime < validation.validated.startTime) {
            const tempTime = validation.validated.endTime;
            validation.validated.endTime = validation.validated.startTime;
            validation.validated.startTime = tempTime;
        }

        // quantity of tickets
        if (!/^(-?[1-9]|-?10)$/.test(inputData.quantityValue.trim())) {
            validation.errors.push(`Quantity of tickets: ${inputData.quantityValue} is not between [-10,-1],[1,10]`);
        } else {
            validation.validated.quantity = parseInt(inputData.quantityValue);
        }

        // don't allow removal of uses for all supporters
        if (!inputData.usernameValue && validation.validated.quantity < 0) {
            validation.errors.push('You can\'t remove usages for all users');
        }

        // set start time to 24 hours before if no time is input and refunding
        if (validation.validated.quantity > 0 && validation.validated.noTime) {
            validation.validated.startTime = Date.now() - (24 * 60 * 60 * 1000);
        }
        return validation;
    },

    confirmationBuilder(validated) {
        const username = validated.user?.username || 'ALL SUPPORTERS!';
        const quantity = Math.abs(validated.quantity);
        const refundOrRemove = validated.quantity < 0 ? 'TAKE AWAY' : 'REFUND';
        const startTime = this.dateFormatter(validated.startTime);
        const endTime = this.dateFormatter(validated.endTime);
        let timePeriod;
        if (validated.quantity < 0) {
            if (validated.noTime) {
                timePeriod = `, counted as being used at the current time, ${startTime}`;
            } else {
                timePeriod = `, counted as being used at ${startTime}`;
            }
        } else {
            timePeriod = validated.noTime ? ' most recently used' : ` for usages in the time period between ${startTime} and ${endTime}`;
        }
        const confirmation = `Are you sure you want to ${refundOrRemove} a max of ${quantity} supporter usage(s)${timePeriod} for ${username}?`;

        const embed = new EmbedBuilder()
            .setTitle('Confirmation')
            .setDescription(confirmation)
            .setColor('#0099ff');

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirmEdit')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancelEdit')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);
        return {
            embed: [embed],
            row: [actionRow]
        };
    },

    queryBuilder(validated) {
        // Insert record(s) (take away)
        if (validated.quantity < 0) {
            const values = [validated.user.id, validated.guildid, validated.startTime];
            const placeholders = Array.from({ length: Math.abs(validated.quantity) }, () => '(?, ?, ?)').join(', ');
            return {
                query: `INSERT INTO supporterusage (userid, guildid, utime) VALUES ${placeholders}`,
                values: Array.from({ length: Math.abs(validated.quantity) }, () => [...values]).flat()
            };
        }

        // Refund for individual
        if (validated.user) {
            return {
                query: 'DELETE FROM supporterusage WHERE userid = ? AND utime BETWEEN ? AND ? ORDER BY utime DESC LIMIT ?',
                values: [validated.user.id, validated.startTime, validated.endTime, Math.abs(validated.quantity)]
            };
        }
        // Refund for all supporters
        return {
            query: `DELETE FROM supporterusage WHERE idsupporterusage in 
            (SELECT idsupporterusage
            FROM (
                SELECT idsupporterusage,
                    ROW_NUMBER() OVER (PARTITION BY userid ORDER BY utime DESC) AS row_num
                FROM supporterusage
                WHERE utime BETWEEN ? AND ?
            ) AS ranked_rows
            WHERE row_num <= ?)`,
            values: [validated.startTime, validated.endTime, validated.quantity]
        };
    },

    dateFormatter(utcDate) {
        const options = {
            timeZone: 'America/New_York', // Specify EST time zone
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        };

        const formatter = new Intl.DateTimeFormat('en-US', options);
        const formattedDate = formatter.format(utcDate);
        return formattedDate;
    }
};
