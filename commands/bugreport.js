const { Discord, MessageEmbed } = require('discord.js')
const { response } = require('express')
require('../lib/extensions.js')

module.exports = {
    name: 'bugreport',
    role: 'eventrl',
    description: 'Sends a bug report',

    
    async execute(message, args, bot) {
        let author = message.author
        let dm = author.createDM()
        let response;
        let embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Bug Report')
            .setAuthor({name: message.member.nickname, iconURL: author.displayAvatarURL()})

        //Ask for the current bugged command
        author.send("Hello " + message.member.nickname + "!")
        author.send("What command caused the problem?")
        response = (await dm.then(c => c.next(null, null, author.id))).content;
        embed.addField('Command:', response)
        await author.send({embeds: [embed] })

        //Ask for the full description of the bug
        author.send("What was the problem? (Please articulate your problem)")
        response = (await dm.then(c => c.next(null, null, author.id))).content;
        embed.addField('Description:', response)
        await author.send({embeds: [embed] })

        //Ask for the link to the message
        author.send("Please link your original message (Right click the message and press `Copy Message Link`)")
        response = (await dm.then(c => c.next(null, null, author.id))).content;
        embed.addField('Message Link:', response)
        await author.send({embeds: [embed] })

        //Ask for any attachments
        author.send("Do you have any other attachments? (Images, etc.)")
        response = (await dm.then(c => c.next(null, null, author.id)));
        if (response.attachments.size >= 1) {
            response.attachments.forEach(element => {
                embed.setImage(element.url)
            });
        }

        //Confirmation
        this.editEmbed(author, embed, dm)
    },

    async editEmbed(author, embed, dm) {
        let response
        author.send("Confirm that the information is correct: ")
        
        let msg = await author.send({ embeds: [embed] })
        author.send('React to 1️⃣ to change the command.')
        author.send('React to 2️⃣ to change the description.')
        author.send('React to 3️⃣ to change the message link.')
        author.send('React to 4️⃣ to change the image.')
        author.send('React to ✅ to send to`#bug-reports`.')
        author.send('React to ❌ to abort the report.')
        
        msg.react('1️⃣')
            .then(msg.react('2️⃣'))
            .then(msg.react('3️⃣'))
            .then(msg.react('4️⃣'))
            .then(msg.react('✅'))
            .then(msg.react('❌'))
        let reactionCollector = msg.createReactionCollector({
            filter: (r, u) => u.id == author.id && (r.emoji.name === '1️⃣' ||
                r.emoji.name === '2️⃣' || r.emoji.name === '3️⃣' || r.emoji.name === '4️⃣' || r.emoji.name === '✅' || r.emoji.name === '❌')
        })
        
        reactionCollector.on('collect', async (r, u) => {
            reactionCollector.stop()
            //Send Message to #Bug reports
            if (r.emoji.name === '1️⃣') {
                author.send("Edit Command Name: ")
                response = (await dm.then(c => c.next(null, null, author.id))).content;
                embed.fields[0].value = response
                this.editEmbed(author, embed, dm)
    
            } else if (r.emoji.name === '2️⃣') {
                author.send("Edit Command Description: ")
                response = (await dm.then(c => c.next(null, null, author.id))).content;
                embed.fields[1].value = response
                this.editEmbed(author, embed, dm)
                
            } else if (r.emoji.name === '3️⃣') {
                author.send("Edit Discord Message Link: ")
                response = (await dm.then(c => c.next(null, null, author.id))).content;
                embed.fields[2].value = response
                this.editEmbed(author, embed, dm)
                
            } else if (r.emoji.name === '4️⃣') {
                author.send("Edit Image Submission: ")
                response = (await dm.then(c => c.next(null, null, author.id)));
                if (response.attachments.size >= 1) {
                    response.attachments.forEach(element => {
                        embed.setImage(element.url)
                    });
                }
                this.editEmbed(author, embed, dm)
                
            } else if (r.emoji.name === '✅') {
                author.send("Bug report published.")
                message.reply({ embeds: [embed] })
    
            } else if (r.emoji.name === '❌') {
                author.send("Bug report aborted.")
            }
        })
    }
}