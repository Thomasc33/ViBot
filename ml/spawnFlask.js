
const { config } = require('../lib/settings');
const { spawn } = require('child_process');
const cwd = process.cwd() + '/ml';
async function launchFlask() {
    if (config.launch_flask) {
        spawn('python3', ['main.py'], {
            cwd
        });
    }
}

module.exports = launchFlask;
