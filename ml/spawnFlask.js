
const botSettings = require('../settings.json')
const { spawn } = require('child_process')
const cwd = process.cwd() + '/ml'
async function launchFlask() {
    if (botSettings.launch_flask) {
        spawn('python3', ['main.py'], {
            cwd
        })
    }
}

module.exports = launchFlask
