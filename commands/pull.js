const { spawn } = require('child_process');
const { botOwners } = require('../settings.json');
const Discord = require('discord.js');
const process = require('process');
const cwd = process.cwd();
const package = require('../package.json')
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
        if (!botOwners.includes(message.author.id)) return;

        await this.attemptVersionUpdate(message)

        let embed = new Discord.EmbedBuilder({
            title: 'Pulling From Github',
            color: 0x00FF00,
        })

        let m = await message.channel.send({embeds: [embed]})

        let desc = '```shell\n'

        console.log('Pulling from github')
        try {
            const gitpull = spawn('git', ['pull'], {
                cwd: cwd
            })

            gitpull.on('error', (err) => {
                console.error(`Error running command: ${err}`);

                desc += data + '\n'
                embed.setDescription(desc + '```')
                embed.setColor(0xFF0000)
                m.edit({embeds: [embed]})
            })

            gitpull.on('close', (code) => {
                console.log(`Command exited with code ${code}`);

                embed.setDescription(desc + '\n```' + '\nExited with code ' + code)
                m.edit({embeds: [embed]})
            })

            gitpull.stdout.on('data', (data) => {
                console.log(`Command output: ${data}`);

                desc += data + '\n'
                embed.setDescription(desc + '```')
                m.edit({embeds: [embed]})
            })
        } catch (e) {
            console.error(e)
        }
    },

    /**
     * 
     * @param {Discord.Message} message 
     */
    async attemptVersionUpdate(message) {
        /** @type {string} */
        const current = package.version
        const [major,minor,bug] = current.split('.').map(c => parseInt(c))
        const embed = new Discord.EmbedBuilder()
            .setTitle('Version Change')
            .setDescription(`The current version is ${current}. How would you like to update the version?`)
        
        const majorBtn = new Discord.ButtonBuilder()
            .setCustomId('major')
            .setLabel(`Major (${major+1}.0.0)`)
            .setStyle(Discord.ButtonStyle.Primary)
        const minorBtn = new Discord.ButtonBuilder()
            .setCustomId('minor')
            .setLabel(`Minor (${major}.${minor+1}.0)`)
            .setStyle(Discord.ButtonStyle.Primary)
        const bugBtn = new Discord.ButtonBuilder()
            .setCustomId('bug')
            .setLabel(`Bug (${major}.${minor}.${bug+1})`)
            .setStyle(Discord.ButtonStyle.Primary)    
        const noneBtn = new Discord.ButtonBuilder()
            .setCustomId('none')
            .setLabel('No Version Update')
            .setStyle(Discord.ButtonStyle.Danger)
        
        const components = new Discord.ActionRowBuilder()
            .addComponents(majorBtn, minorBtn, bugBtn, noneBtn)
        
        const resultant = await message.channel.send({ embeds: [embed], components: [components] })
        const collector = resultant.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, filter: i => i.user.id == message.author.id })
        
        const updateVersion = (version, err) => {
            if (current == version) {
                embed.setDescription(`Did not update version from \`${current}\``)
            
                if (err) embed.addFields({ 'name': 'Error', value: `\`\`\`${err}\`\`\``})
            
                //revert file changes
                package.version = version
                require('fs').writeFileSync('package.json', JSON.stringify(package, null, 2))
            }
            else embed.setDescription(`Updated version from \`${current}\` to \`${version}\``)
            
            resultant.edit({ embeds: [embed], components: [] })
        }
        
        const newVersion = await new Promise((resolve) => {
            collector.once('collect', i => {
                collector.stop()
                switch (i.customId) {
                    case 'major': return resolve(`${major+1}.0.0`)
                    case 'minor': return resolve(`${major}.${minor+1}.0`)
                    case 'bug': return resolve(`${major}.${minor}.${bug+1}`)
                    case 'none': return resolve(current)
                }
            })
        })
        if (current == newVersion) {
            updateVersion(current)
            return current
        }

        return new Promise((resolve) => {
            package.version = newVersion
            require('fs').writeFileSync('package.json', JSON.stringify(package, null, 2))
            const gitadd = spawn('git', ['add', 'package.json'], { cwd })
            let error = false
            gitadd.on('error', () => {
                error = true
                resolve(current)
            })
            gitadd.on('close', code => {
                if (error) return updateVersion(current)
                const gitcommit = spawn('git', ['commit','-m',`Automatic version update ${current} => ${newVersion}`], { cwd })
                gitcommit.on('error', () => {
                    error = true
                    resolve(current)
                })
                gitcommit.on('close', code => {
                    if (error) return updateVersion(current)
                    const gitpush = spawn('git', ['push'], { cwd })
                    gitpush.on('error', () => {
                        error = true
                        resolve(current)
                    })
                    gitpush.on('close', code => {
                        if (error) return updateVersion(current)
                        updateVersion(newVersion)
                        resolve(newVersion)
                    })
                })
            })
        })
    }
}
