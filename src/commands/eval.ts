import { Pool } from 'mysql2/promise';
import { botOwners } from '../settings.json';
import { Client, Message } from 'discord.js';

export default {
    name: 'eval',
    role: 'moderator',
    description: 'Runs the message given as if it was code',
    async execute(message: Message, args: string[], bot: Client, db: Pool) {
        if (!botOwners.includes(message.author.id)) return;
        const command = message.content.substring(6);
        console.log(`evaling from ${message.member?.nickname} -> \n${command}`);
        try {
            console.log(eval(command));
        } catch (error) {
            console.log(`eval failed with error:\n${error}`);
            message.reply(`Error:\n${error}`);
        }
    }
};