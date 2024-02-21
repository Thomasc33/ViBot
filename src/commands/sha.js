const fs = require('fs');
const { slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'sha',
    role: 'assistantdev',
    description: 'Gets current git commit SHA',
    args: [],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild);
    },
    async execute(message) {
        let sha = fs.readFileSync('.git/HEAD').toString().trim();
        if (sha.startsWith('ref: ')) {
            sha = fs.readFileSync(`.git/${sha.slice(4).trim()}`).toString().trim();
        }
        await message.reply({ content: `Current commit: \`${sha.trim()}\``, ephemeral: true });
    }
};
