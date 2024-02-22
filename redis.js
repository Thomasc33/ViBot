const { createClient } = require('redis');
const { getDB } = require('./dbSetup.js');
const Discord = require('discord.js');
const { config: { redis } } = require('./lib/settings');

let client;

/* The MockMessage class is a JavaScript class that represents a message in a webhook interaction and
provides methods for deleting and editing the message. */
class MockMessage {
    constructor(webhook, interaction) {
        this.webhook = webhook;
        this.interaction = interaction;
    }

    async delete() {
        return await this.webhook.deleteMessage(this.interaction.message.id);
    }

    async edit(opts) {
        return await this.webhook.editMessage(this.interaction.message, opts);
    }
}

module.exports = {
    /* The `async setup()` function is responsible for setting up the Redis client connection. */
    async setup() {
        client = createClient(redis);

        client.on('error', err => console.log('Redis Client Error: ', err));

        await client.connect();
    },
    async createReactionRow(message, commandName, callback, buttons, allowedUser, state) {
        // eslint-disable-next-line camelcase
        let opts = { valid_ids: JSON.stringify(buttons.components.map((c) => c.data.custom_id)), command: commandName, callback, state: JSON.stringify(state) };
        if (message instanceof Discord.InteractionResponse) opts = { token: message.interaction.token, whid: message.interaction.webhook.id, ...opts };
        if (allowedUser) opts.allowedUser = allowedUser.id;
        const key = 'messagebuttons:' + (await message.fetch()).id;
        // eslint-disable-next-line new-cap
        await client.multi().HSET(key, opts).EXPIRE(key, 86400 /* 1 day */).exec();
    },
    async handleReactionRow(bot, interaction) {
        if (!(interaction instanceof Discord.ButtonInteraction)) return false;
        // eslint-disable-next-line new-cap
        const data = await client.HGETALL('messagebuttons:' + interaction.message.id);
        if (!data.command || !data.callback) return false;
        if (data.allowedUser && data.allowedUser != interaction.user.id) return false;
        const command = bot.commands.get(data.command) || bot.commands.find(cmd => cmd.alias && cmd.alias.includes(data.command));
        const callback = command[data.callback];
        const db = getDB(interaction.guild.id);
        if (data.token) {
            const resp = new MockMessage(new Discord.InteractionWebhook(bot, data.whid, data.token), interaction);
            await callback(bot, resp, db, interaction.customId, JSON.parse(data.state));
        } else {
            const resp = interaction.message;
            resp.interaction = interaction;
            await callback(bot, resp, db, interaction.customId, JSON.parse(data.state));
        }
        return true;
    }
};
