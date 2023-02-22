const { spawn } = require('child_process');

module.exports = {
    name: 'pull',
    role: 'moderator',
    description: 'pull code from github',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {String[]} args 
     * @param {Discord.Client} bott 
     * @param {import('mysql').Connection} db 
     */
    async execute(message, args, bot, db) {
        if (!['277636691227836419', '258286481167220738'].includes(message.author.id)) return;

        spawn('git', ['pull'])
            .on('error', (err) => {
                console.error(`Error running command: ${err}`);
                message.channel.send(`Error running command: ${err}`);
            })
            .on('close', (code) => {
                console.log(`Command exited with code ${code}`);
                message.channel.send(`Command exited with code ${code}`);
            });
    }
}
