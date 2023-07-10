const Discord = require('discord.js')
const FalseSuspends = require('./falseSuspensions')
const EventDupes = require('./eventDupes')
const eventDupes = require('./eventDupes')
const ignores = require('../data/checkIgnores.json');
module.exports = {
    name: 'check',
    role: 'security',
    description: 'Performs several checks on stuff in the server',
    async execute(message, args, bot, db) {
        const channel = message.channel;
        const guild = channel.guild;
        const settings = bot.settings[guild.id];
        if (settings.backend.upgradedCheck) {
            const temporaryKeyPoppers = [];
            const duplicateNicknames = {};
            const verifiedWithoutNickname = [];
            const unverifiedWithNickname = [];
            const eventBoiAndVerified = [];
            const falseSuspensions = [];
            const unansweredModmails = [];
            const unansweredVerifications = [];
            const unansweredVeteranVerifications = [];
            const userWithNoRole = [];
            const userWithUnverifiedAndRaider = [];

            const suspends = await getSuspends(guild, db);

            const embed = new Discord.EmbedBuilder()
                .setAuthor({ name: `Check Report` });

            let report = await channel.send({ embeds: [embed] })

            function debounceEdit() {
                if (!debounceEdit.timeout) {
                    debounceEdit.timeout = setTimeout(() => {
                        debounceEdit.timeout = null;
                        report.edit({ embeds: [embed] });
                    }, 750);
                }
            }

            async function updateEmbed(title, array, join) {

                embed.addFields({ name: title, value: 'None!' });
                if (array.length == 0) {
                    if (JSON.stringify(embed.toJSON()).length + title.length + 'None!'.length >= 6000) {
                        embed.data.fields = [{
                            name: title,
                            value: 'None!'
                        }];
                        report = await channel.send({ embeds: [embed] });
                    } else {
                        debounceEdit();
                    }
                    return;
                }
                embed.data.fields[embed.data.fields.length - 1].value = '';
                for (const item of array) {
                    if (JSON.stringify(embed.toJSON()).length + item.length + join.length >= 6000) {
                        debounceEdit();
                        embed.data.fields = [{
                            name: title,
                            value: `${item}`
                        }];
                        report = await channel.send({ embeds: [embed] })
                    } else if (embed.data.fields[embed.data.fields.length - 1].value.length + item.length + join.length >= 1024) {
                        embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.substring(join.length);
                        embed.addFields({ name: title + " Continued", value: join + `${item}` });
                    } else {
                        embed.data.fields[embed.data.fields.length - 1].value += join + `${item}`;
                    }
                }
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.substring(join.length);
                debounceEdit();
            }

            //duplicate nickname, temporary key popper, event raider + verified raider, unverified with nickname, false suspensions, some unverified role stuff
            await new Promise(res => {
                guild.members.cache.forEach(member => {
                    if (ignores[guild.id] && ignores[guild.id].includes(member.id))
                        return;
                    //duplicate nickname
                    if (member.nickname !== null && member.nickname !== '') {
                        const nicks = member.nickname.toLowerCase().replace(/[^a-z|]/gi, '').split('|');
                        for (const nick of nicks)
                            duplicateNicknames[nick] = [...(duplicateNicknames[nick] || []), `<@!${member.id}>`];

                    }
                    if (settings) {
                        //temporary key popper
                        if (settings.roles.tempkey && member.roles.cache.has(settings.roles.tempkey))
                            temporaryKeyPoppers.push(`<@!${member.id}>`);

                        const isVerified = settings.roles.raider && member.roles.cache.has(settings.roles.raider);
                        const isEBoy = settings.roles.eventraider && member.roles.cache.has(settings.roles.eventraider) && settings.backend.giveEventRoleOnDenial2;

                        //event raider + verified raider
                        if (settings.roles.eventraider && settings.roles.raider && isVerified && isEBoy)
                            eventBoiAndVerified.push(`<@!${member.id}>`);

                        //verified without nickname
                        if ((isVerified || isEBoy) && (member.nickname === null || member.nickname === ''))
                            verifiedWithoutNickname.push(`<@!${member.id}>`);

                        //unverified with nickname
                        if ((member.roles.cache.size < 2 || (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified))) && member.nickname !== null && member.nickname !== '')
                            unverifiedWithNickname.push(`<@!${member.id}>`)

                        //false suspensions
                        if (settings.roles.tempsuspended && member.roles.cache.has(settings.roles.tempsuspended) && !suspends.includes(member.id))
                            falseSuspensions.push(`<@!${member.id}>`)
                        
                        // User with no roles
                        if (settings.backend.useUnverifiedRole && member.roles.cache.size == 1) {
                            userWithNoRole.push(`<@!${member.id}>`)
                        }

                        // User with both Unverified AND raider
                        if (settings.backend.useUnverifiedRole && (member.roles.cache.has(settings.roles.raider) || member.roles.highest.position > message.guild.roles.cache.get(settings.roles.raider).position) && member.roles.cache.has(settings.roles.unverified)) {
                            userWithUnverifiedAndRaider.push(`<@!${member.id}>`)
                        }
                    }
                });
                res();
            })
            const dupeNameStrings = Object.entries(duplicateNicknames).map(dn => dn[1].length > 1 ? `\`${dn[0]}\`: ${dn[1].join('\\↔️')}` : null).filter(d => !!d);

            updateEmbed(`Temporary Key Poppers`, temporaryKeyPoppers, ', ');
            updateEmbed(`Both Verified Raider and Event Boi`, eventBoiAndVerified, ', ');
            updateEmbed(`Duplicate Names`, dupeNameStrings, '\n');
            updateEmbed(`No Nickname`, verifiedWithoutNickname, ', ');
            updateEmbed(`Unverified With Nickname`, unverifiedWithNickname, ', ');
            if (settings.backend.useUnverifiedRole) {
                updateEmbed(`Users with no Roles`, userWithNoRole, ', ');
                updateEmbed(`Users with BOTH Raider and Unverified`, userWithUnverifiedAndRaider, ', ');
            }

            //unanswered modmails
            await new Promise(async res => {
                if (!settings.channels.modmail)
                    unansweredModmails.push(`Modmail is not configured for this server.`);
                else {
                    const modmail = guild.channels.cache.get(settings.channels.modmail);
                    if (!modmail)
                        unansweredModmails.push(`Could not find the modmail channel <#${settings.channels.modmail}>`);
                    else {
                        const messages = await modmail.messages.fetch({ limit: 100 })
                        messages.each(async m => {
                            if (m.components.length > 0 && m.author.bot)
                                unansweredModmails.push(`[${m.nickname || 'Module'}](${m.url})`)
                        })
                    }
                }
                res();
            });

            updateEmbed(`Pending ModMail`, unansweredModmails, ', ');
            //pending verifications
            await new Promise(async res => {
                if (!settings.channels.manualverification)
                    unansweredVerifications.push(`Verifications are not configured for this server.`);
                else {
                    const veri = guild.channels.cache.get(settings.channels.manualverification);
                    if (!veri)
                        unansweredVerifications.push(`Could not find the verification channel <#${settings.channels.manualverification}>`);
                    else {
                        const messages = await veri.messages.fetch({ limit: 100 });
                        messages.each(m => {
                            if (m.reactions.cache.has('🔑'))
                                unansweredVerifications.push(`[${m.embeds[0].author.name.split(' ').pop()}](${m.url})`)
                        })
                    }
                }
                res();
            });

            updateEmbed(`Pending Verifications`, unansweredVerifications, ', ');

            //pending veteran verifications
            await new Promise(async res => {
                if (!settings.channels.manualverification)
                    unansweredVeteranVerifications.push(`Verifications are not configured for this server.`);
                else {
                    const veri = guild.channels.cache.get(settings.channels.manualvetverification);
                    if (!veri)
                        unansweredVeteranVerifications.push(`Could not find the verification channel <#${settings.channels.manualvetverification}>`);
                    else {
                        const messages = await veri.messages.fetch({ limit: 100 });
                        messages.each(m => {
                            if (m.reactions.cache.has('🔑'))
                                unansweredVeteranVerifications.push(`[${m.embeds[0].author.name.split(' ').pop()}](${m.url})`)
                        })
                    }
                }
                res();
            });

            updateEmbed(`Pending Veteran Verifications`, unansweredVeteranVerifications, ', ');
            updateEmbed(`False Suspensions`, falseSuspensions, ', ');
        } else {

            let settings = bot.settings[message.guild.id]
            let checkMessage = await message.channel.send('Checking information on the server. This may take a little bit.')
            let checkEmbed = new Discord.EmbedBuilder()
                .setTitle('Check Report')
            //temporary keypopper
            checkEmbed.addFields({ name: 'Temporary Key Poppers', value: 'None!' })
            message.guild.members.cache.filter(u => u.roles.cache.has(settings.roles.tempkey)).each(m => {
                if (checkEmbed.data.fields[0].value == 'None!') checkEmbed.data.fields[0].value = `<@!${m.id}>`
                else checkEmbed.data.fields[0].value = checkEmbed.data.fields[0].value.concat(`, <@!${m.id}>`)
            })
            //people with same name
            let dupesArray = []

            let allMembers = message.guild.members.cache.filter(u => u.nickname && (u.roles.cache.has(settings.roles.raider) || (u.roles.cache.has(settings.roles.eventraider) && settings.backend.giveEventRoleOnDenial2))).map(m => m)
            let allNames = message.guild.members.cache.filter(u => u.nickname && (u.roles.cache.has(settings.roles.raider) || (u.roles.cache.has(settings.roles.eventraider) && settings.backend.giveEventRoleOnDenial2))).map(m => m.nickname.toLowerCase().replace(/[^a-z|]/gi, "").split("|"))
            allNames = allNames.flat()
            let uniqueNames = [...new Set(allNames)]
            for (var i in uniqueNames) {
                allNames.splice(allNames.indexOf(uniqueNames[i]), 1)
            }
            allNames = [...new Set(allNames)]
            for (var i in allNames) {
                let dupes = allMembers.filter(m => m.nickname.toLowerCase().replace(/[^a-z|]/gi, "").split("|").includes(allNames[i]))
                dupes = dupes.map(m => dupesArray.push(m.id))
            }
            dupesArray = dupesArray.filter((item, index) => dupesArray.indexOf(item) === index)
            checkEmbed.addFields({ name: 'Duplicate Names', value: 'None!' })
            for (let i in dupesArray) {
                if (checkEmbed.data.fields[1].value == 'None!') checkEmbed.data.fields[1].value = `<@!${dupesArray[i]}>`
                else checkEmbed.data.fields[1].value += `, <@!${dupesArray[i]}>`
            }
            //pending verifications
            let veriPending = message.guild.channels.cache.get(settings.channels.manualverification)
            checkEmbed.addFields({ name: 'Pending Verifications', value: 'None!' })
            if (!veriPending) checkEmbed.data.fields[2].value = 'Error finding channel'
            else {
                let messages = await veriPending.messages.fetch({ limit: 100 })
                messages.each(m => {
                    if (m.reactions.cache.has('🔑')) {
                        if (checkEmbed.data.fields[2].value == 'None!') checkEmbed.data.fields[2].value = `[Module](${m.url})`
                        else checkEmbed.data.fields[2].value += `, [Module](${m.url})`
                    }
                })
            }
            //pending vet verification
            let veriPendingVet = message.guild.channels.cache.get(settings.channels.manualvetverification)
            checkEmbed.addFields({ name: 'Pending Veteran Verification', value: 'None!' })
            if (!veriPendingVet) checkEmbed.data.fields[3].value = 'Error finding channel'
            else {
                let messages = await veriPendingVet.messages.fetch({ limit: 100 })
                messages.each(m => {
                    if (m.reactions.cache.has('🔑')) {
                        if (checkEmbed.data.fields[3].value == 'None!') checkEmbed.data.fields[3].value = `[Module](${m.url})`
                        else checkEmbed.data.fields[3].value += `, [Module](${m.url})`
                    }
                })
            }
            //pending mod mail
            let modMailChannel = message.guild.channels.cache.get(settings.channels.modmail)
            checkEmbed.addFields({ name: 'Pending ModMail', value: 'None!' })
            if (!modMailChannel) checkEmbed.data.fields[4].value = 'Error finding channel'
            else {
                let messages = await modMailChannel.messages.fetch({ limit: 100 })
                messages.each(m => {
                    if (m.components.length > 0 && m.author.id == bot.user.id) {
                        if (checkEmbed.data.fields[4].value == 'None!') checkEmbed.data.fields[4].value = `[Module](${m.url})`
                        else checkEmbed.data.fields[4].value += `, [Module](${m.url})`
                    }
                })
            }
            //no nicknames
            let nn = []
            let noNickname = message.guild.members.cache.filter(m => m.nickname == null);
            noNickname.each(user => {
                if (user.roles.cache.has(settings.roles.raider) || (user.roles.cache.has(settings.roles.eventraider) && settings.backend.giveEventRoleOnDenial2)) {
                    nn.push(user)
                }
            })
            checkEmbed.addFields({ name: 'No Nicknames', value: 'None!' })
            for (let i in nn) {
                if (checkEmbed.data.fields[5].value == 'None!') checkEmbed.data.fields[5].value = `${nn[i]}`
                else checkEmbed.data.fields[5].value += `, ${nn[i]}`
            }
            for (let i in checkEmbed.data.fields) {
                if (checkEmbed.data.fields[i].value.length >= 1024) {
                    let replacementEmbed = new Discord.EmbedBuilder()
                        .setTitle(checkEmbed.data.fields[i].name)
                        .setDescription('None!')
                    checkEmbed.data.fields[i].value.split(', ').forEach(s => {
                        fitStringIntoEmbed(replacementEmbed, s, message.channel)
                    })
                    message.channel.send({ embeds: [replacementEmbed] })
                    checkEmbed.data.fields[i].value = 'See Below'
                }
            }
            checkMessage.edit({ content: null, embeds: [checkEmbed] })
            FalseSuspends.execute(message, args, bot, db)
            if (!settings.backend.giveeventroleonverification) eventDupes.execute(message, args, bot, db)
        }
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `, ${string}`.length >= 2048) {
        if (!embed.data.fields) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `, ${string}`.length >= 1024) {
            if (JSON.stringify(embed.toJSON()).length + `, ${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (JSON.stringify(embed.toJSON()).length + `, ${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`, ${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`, ${string}`))
    }
}

async function getSuspends(guild, db) {
    return new Promise((res, rej) => {
        db.query(`SELECT * FROM suspensions WHERE suspended = true AND guildid = '${guild.id}'`, (err, rows) => {
            if (err) return rej(err)
            res(rows.map(row => row.id));
        })
    })
}