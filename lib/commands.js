const { Collection } = require('discord.js');
const { readdirSync } = require('fs');

const commands = new Collection();

module.exports = {
    commands,
    load() {
        const files = readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of files) {
            const command = require(`../commands/${file}`);
            commands.set(command.name, command);
        }
    }
}