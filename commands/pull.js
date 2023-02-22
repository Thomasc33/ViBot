const { exec } = require('child_process');

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
        if (!['277636691227836419','258286481167220738'].includes(message.author.id)) return;

        exec('git pull', (err, stdout, stderr) => {
            if (err) {
                message.channel.send(`error: ${err.message}`);
                return;
            }
            if (stderr) {
                message.channel.send(`stderr: ${stderr}`);
                return;
            }
            message.channel.send(`stdout: ${stdout}`);
        });
    }
}
