const { Discord, MessageEmbed } = require('discord.js')
require('../lib/extensions.js')
const ErrorLogger = require('../lib/logError')
// import { dmHandler } from '/index.js';

module.exports = {
    name: 'bugreport',
    role: 'eventrl',
    description: 'Sends a bug report',

    
    async execute(message, args, bot, db) {
        let dm = message.author.createDM()
        let response;
        let embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Bug Report')
            .setAuthor({ name: message.member.nickname, iconURL: message.author.displayAvatarURL() })
            .setFooter(`Type 'cancel' to stop`)

        //Ask for the current bugged command
        dm.send("Hello " + message.member.nickname + "!")
        dmHandler("What command caused the problem?")
        response = (await dm.then(c => c.next(null, null, message.author.id))).content;
        embed.addField('Command:', response)
        await message.author.send({embeds: [embed] })

        //Ask for the full description of the bug
        message.author.send("What was the problem? (Please articulate your problem)")
        response = (await dm.then(c => c.next(null, null, message.author.id))).content;
        embed.addField('Description:', response)
        await message.author.send({embeds: [embed] })

        //Ask for the link to the message
        message.author.send("Please link your original message (Right click the message and press `Copy Message Link`)")
        response = (await dm.then(c => c.next(null, null, message.author.id))).content;
        embed.addField('Message Link:', response)
        await message.author.send({embeds: [embed] })

        //Ask for any attachments
        message.author.send("Do you have any other attachments? (Images, etc.)")
        response = (await dm.then(c => c.next(null, null, message.author.id)));
        if (response.attachments.size >= 1) {
            response.attachments.forEach(element => {
                embed.setImage(element.url)
            });
        }

        //Confirmation
        this.editEmbed(message, embed, dm, db)
    },

    async editEmbed(message, embed, dm, db) {
        let response
        message.author.send("Confirm that the information is correct: ")
        
        let msg = await message.author.send({ embeds: [embed] })
        message.author.send('React to 1️⃣ to change the command.')
        message.author.send('React to 2️⃣ to change the description.')
        message.author.send('React to 3️⃣ to change the message link.')
        message.author.send('React to 4️⃣ to change the image.')
        message.author.send('React to ✅ to send to`#bug-reports`.')
        message.author.send('React to ❌ to abort the report.')
        
        msg.react('1️⃣')
            .then(msg.react('2️⃣'))
            .then(msg.react('3️⃣'))
            .then(msg.react('4️⃣'))
            .then(msg.react('✅'))
            .then(msg.react('❌'))
        let reactionCollector = msg.createReactionCollector({
            filter: (r, u) => u.id == message.author.id && (r.emoji.name === '1️⃣' ||
                r.emoji.name === '2️⃣' || r.emoji.name === '3️⃣' || r.emoji.name === '4️⃣' || r.emoji.name === '✅' || r.emoji.name === '❌')
        })
        
        reactionCollector.on('collect', async (r, u) => {
            reactionCollector.stop()
            //Send Message to #Bug reports
            if (r.emoji.name === '1️⃣') {
                message.author.send("Edit Command Name: ")
                response = (await dm.then(c => c.next(null, null, message.author.id))).content;
                embed.fields[0].value = response
                this.editEmbed(message, embed, dm, db)
    
            } else if (r.emoji.name === '2️⃣') {
                message.author.send("Edit Command Description: ")
                response = (await dm.then(c => c.next(null, null, message.author.id))).content;
                embed.fields[1].value = response
                this.editEmbed(message, embed, dm, db)
                
            } else if (r.emoji.name === '3️⃣') {
                message.author.send("Edit Discord Message Link: ")
                response = (await dm.then(c => c.next(null, null, message.author.id))).content;
                embed.fields[2].value = response
                this.editEmbed(message, embed, dm, db)
                
            } else if (r.emoji.name === '4️⃣') {
                message.author.send("Edit Image Submission: ")
                response = (await dm.then(c => c.next(null, null, message.author.id)));
                if (response.attachments.size >= 1) {
                    response.attachments.forEach(element => {
                        embed.setImage(element.url)
                    });
                }
                this.editEmbed(message, embed, dm, db)
                
            } else if (r.emoji.name === '✅') {
                embed.setTimeStamp
                message.author.send("Bug report published.")
                message.client.cache.channels.get('756246227766738994').send({ embeds: [embed] })
    
            } else if (r.emoji.name === '❌') {
                message.author.send("Bug report aborted.")

            }
        })
    }
}