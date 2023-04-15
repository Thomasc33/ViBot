const { createClient } = require('redis')
const { getDB } = require('./dbSetup.js')
const Discord = require('discord.js')

let client

module.exports = {
    async setup() {
        client = createClient({
            socket: {
                host: 'localhost',
                port: '8000'
            }
        });

        client.on('error', err => console.log('Redis Client Error: ', err));

        await client.connect();
    },
    async createReactionRow(message, commandName, callback, buttons, allowedUser, state) {
        const opts = {token: message.interaction.token, whid: message.interaction.webhook.id, commandId: message.interaction.commandId, valid_ids: JSON.stringify(buttons.components.map((c) => c.data.custom_id)), command: commandName, callback: callback, state: JSON.stringify(state)}
        if (allowedUser) opts.allowedUser = allowedUser.id
        await client.HSET('messagebuttons:' + (await message.fetch()).id, opts)
    },
    async handleReactionRow(bot, interaction) {
        if (!(interaction instanceof Discord.ButtonInteraction)) return false
        const data = await client.HGETALL('messagebuttons:' + interaction.message.id)
        if (!data.command || !data.callback) return false
        if (data.allowedUser && data.allowedUser != interaction.user.id) return false
        const command = bot.commands.get(data.command) || bot.commands.find(cmd => cmd.alias && cmd.alias.includes(data.command))
        const callback = command[data.callback]
        const db = getDB(interaction.guild.id)
        // Hacky disgusting gross way of reconstructing the original InteractionResponse.
        // The *nice* way to do this would be by using `interaction.message`, but
        // unfortunately that doesn't allow deletion because it trys to delete it like a
        // message and not a webhook (don't ask me why that matters).
        // So instead we need to rig up a fake InteractionResponse to make discord.js
        // delete messages the right way.
        // Here's the clean way to *just* do deletion:
        // return await (new Discord.Webhook(bot, {id: data.whid, token: data.token})).deleteMessage(interaction.message.id)
        console.log(interaction.guild.id)
        const mockInteraction = new Discord.ChatInputCommandInteraction(bot, {
            message: interaction.message.id,
            id: data.whid,
            application_id: interaction.applicationId,
            token: data.token,
            channel_id: interaction.channel.id,
            user: interaction.user,
            guild_id: interaction.guild.id,
            type: undefined, // tmp
            data: {
                // id: data.commandId,
                id: data.whid,
                name: data.command,
                type: undefined, // tmp
                token: data.token,
            }
        })
        mockInteraction.replied = true;
        console.log(mockInteraction)
        const resp = new Discord.InteractionResponse(mockInteraction)
        await callback(bot, resp, db, interaction.customId, JSON.parse(data.state))
        return true
    }
}
