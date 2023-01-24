const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
	name: 'list',
	description: 'Displays a list of all users with the specified role.',
	role: 'security',
	args: '<role name/ID>',
	requiredArgs: 1,
	alias: ['roleinfo', 'ri'],
	/**
	 * @param {Discord.Message} message
	 * @param {Array} args
	 * @param {Discord.Client} bot
	 */
	async execute(message, args, bot) {
		let choice = args.join(' ').toLowerCase();

		// Search for role in guild
		const guildRoles = message.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => r);
		let guildRole = null;
		for (const role of guildRoles) {
			if (role.id == args[0]) guildRole = role;
			else if (role.name.toLowerCase() == choice) guildRole = role;
			else if (role.name.toLowerCase().replace(/ /g, '') == choice.replace(/ /g, '')) guildRole = role;
			else if (role.name.toLowerCase().split(' ').map(([v]) => v).join('') == choice) guildRole = role;
			else if (role.name.toLowerCase().substring(0, choice.length) == choice) guildRole = role;
			else if (role == message.mentions.roles.first()) guildRole = role;
			if (guildRole) break;
		}
		if (!guildRole) return message.channel.send('No role was found with that name/ID.');

		const memberList = message.guild.roles.cache.get(guildRole.id).members.map(member => member);
		const rolePosition = guildRole.position;

		const d = { highest: [], higher: [] }
		for (const member of memberList) if (member.roles.highest.position == rolePosition) d.highest.push(member); else d.higher.push(member);

		// List of users where given role is highest position
		let highestString = '';
		for (const member of d.highest) {
			if (highestString.length < 950) highestString += `${member} `;
			else {
				highestString += 'and ' + (d.highest.length - d.highest.indexOf(member)) + ' others...';
				break;
			}
		}

		// List of users with a higher position role
		let higherString = '';
		for (const member of d.higher) {
			if (higherString.length < 950) higherString += `${member} `;
			else {
				higherString += 'and ' + (d.higher.length - d.higher.indexOf(member)) + ' others...';
				break;
			}
		}

		const roleCheckEmbed = new Discord.EmbedBuilder()
			.setColor(guildRole.hexColor)
			.setTitle(`Role Info for ${guildRole.name}`)
			.setDescription(`**Role:** ${guildRole} | **Role Color:** \`${guildRole.hexColor}\``)
			.setFooter({ text: `There are ${memberList.length} members in the ${guildRole.name} role` })
			.setTimestamp()
			.addFields(
				{ name: `${d.higher.length} members with a higher role than \`${guildRole.name}\``, value: d.higher.length > 0 ? higherString : 'None' },
				{ name: `${d.highest.length} members with \`${guildRole.name}\` as their highest role`, value: d.highest.length > 0 ? highestString : 'None' }
			);
		message.channel.send({ embeds: [roleCheckEmbed] }).catch(err => ErrorLogger.log(err, bot, message.guild));
	}
}

const getHighestRole = (guildMember) => {
	const rolePosition = guildMember.roles.cache.reduce(function (acc, role) {
		return Math.max(acc, role.position);
	}, 0);
	return guildMember.roles.cache.find(role => role.position == rolePosition);
};