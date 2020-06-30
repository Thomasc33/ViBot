const mongoose = require('mongoose')

var config = new mongoose.Schema({
    guildID: String,
    prefix: String,
    raiderName: 'Verified Raider',
    eventRoleName: 'Event Boi',
    lowestRaidLeaderRole: 'Almost Raid Leader',
    eventOrganizerRole: 'Event Organizer',

})

var commands = new Map()
const commandFiles = fs.readdirSync('../commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    let CommandConfig = {
        enabled: true,
        role: command.role
    }
}


module.exports = mongoose.model('guildConfigs', config)