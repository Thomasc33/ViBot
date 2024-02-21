const Discord = require('discord.js')
module.exports = {
    name: 'commend',
    role: 'rl',
    args: '<user> <role *see below*>',
    requiredArgs: 2,
    description: 'Gives user a role',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {Array} args 
     * @param {Discord.Client} bot 
     * @param {*} db 
     * @returns
     */
    getNotes(guild, member, bot) {
        const settings = bot.settings[guild.id]
        const roleCache = guild.roles.cache
        return settings.lists.commendRoles.map(role => `${roleCache.get(settings.roles[role])} \`${role}\``).join('\n')
    },
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        // If there are no settings available for this server, commendations wont work
        if (!settings) {
           await message.channel.send("Commendations are not set up for this server")
           return
        }

        let validRoles = settings.lists.commendRoles

        if (!validRoles) {
            await message.channel.send(`Unable to find commendRoles, please contact a developer!`)
            return
        }

        //check args length
        if (args.length < 2) return

        // Find member using findMember prototype
        const member = message.guild.findMember(args[0])

        if (!member) {
            await message.channel.send(`Error looking up ${args[0]}, ensure this is a valid user`)
            return
        }

        // Verify that role is valid to add
        if (!validRoles.includes(args[1])) {
            await message.channel.send(`Error validating ${args[1]}, ensure this is a valid role (based on commends.json)`)
            return
        }

        if (!settings.roles[args[1]]) {
            await message.channel.send(`This role has not been configured on this server, please contact a moderator!`)
            return
        }
        
        // Find role using findRole prototype
        let roleToAdd = message.guild.findRole(settings.roles[args[1]])

        if (!roleToAdd) {
            await message.channel.send(`This role is not assignable on this server!`)
            return
        }

        // Verify the user has the permission to commend this role
        let minimumStaffRole = message.guild.findRole(settings.roles.minimumStaffRole)

        if (!minimumStaffRole) {
            await message.channel.send(`Minimum staff role has not been configured on this server, please contact a moderator!`)
            return
        }

        if (roleToAdd.position > minimumStaffRole.position) {
            await message.channel.send(`The role you are trying to commend is a staff role!`)
            return
        }

        // Ensure the user wants to go through with adding the role with a confirmation action
        await message.channel.send(`Are you sure you want to give ${roleToAdd.name} to ${member.displayName}?`).then(async viMessage => {
            if (await viMessage.confirmButton(message.author.id)) {
                let modlog = viMessage.guild.channels.cache.get(settings.channels.modlogs)
                if (modlog) await modlog.send({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle(`${roleToAdd.name} Commendation`)
                            .addFields([
                                { name: 'Commender', value: `${message.author} \`${message.author.tag}\`` },
                                { name: 'Commended', value: `${member} \`${member.user.tag}\`` },
                                { name: 'Role', value: `${roleToAdd}` }
                            ])
                            .setColor(roleToAdd.hexColor)
                            .setTimestamp()
                    ]
                });
    
                await member.roles.add(roleToAdd.id)
                await viMessage.edit({components: []})
                await viMessage.edit(`Great, member has been commended!`)
            }
            else {
                await viMessage.edit({components: []})
                await viMessage.edit(`Commendation cancelled, have a nice day!`)
            }
        })
    }
}