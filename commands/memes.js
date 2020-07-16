const eury = ['https://cdn.discordapp.com/attachments/488881485366165515/685713463750033413/Eurydice.mp3',]
const cwinner = ['https://cdn.discordapp.com/attachments/488881485366165515/700880664517410956/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/700694536908701771/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/700694273686765578/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699665488699064451/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699665435045396570/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699647903693537661/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642623559729263/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642599996129300/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642582183182406/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642566894682133/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699639459075063848/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699635653729714198/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699473358806319155/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294560353910836/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294529446084671/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294433413300244/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697225226576199720/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070674614681700/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070620919332964/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070590531731476/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070564317331526/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070536987246623/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070438924288010/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070379994447962/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070183633649724/unknown.png']

module.exports = {
    name: 'memes',
    alias: ['phd', 'xbox', 'cwinner'],
    role: 'Almost Raid Leader',
    async execute(message, args, bot) {
        switch (message.content.split(/ +/)[0].replace(/[^a-z]/gi, '').toLowerCase()) {
            case 'phd':
                message.channel.send({ files: ['https://cdn.discordapp.com/attachments/488881485366165515/733195330287304734/unknown.png'] })
                break;
            case 'xbox':
                message.channel.send(`<@!222042597877612546> xbox turn off`)
                break;
            case 'cwinner':
                message.channel.send({ files: [cwinner[~~(cwinner.length * Math.random())]] })
                break;
            case 'eury':
                message.channel.send({ files: [eury[~~(eury.length * Math.random())]] })
                break;
            case 'nefiah':
                let ghost = await message.channel.send(`Ghost pinged bitch <@!188081954728574976>`)
                await ghost.delete()
                message.delete()
                break;
        }
    }
}