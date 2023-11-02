const Discord = require('discord.js')
const { slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'puzzle',
    role: 'eventrl',
    description: 'solve shatters puzzle',
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    /**
     * 
     * @param {Discord.Message} message 
     * @param {String[]} args 
     * @param {Discord.Client} bott 
     * @param {import('mysql').Connection} db 
     */
    async execute(message, args, bot, db) {
        let ephemeral = message instanceof Discord.ChatInputCommandInteraction

        let embed = new Discord.EmbedBuilder()
            .setTitle('Shatters Puzzle')
            .setDescription('Click the buttons to toggle the lights on and off. The goal is to set all the lights to green.')
            .setColor('#015c21')

        let buttons = []
        for (let i = 0; i < 9; i++) {
            let button = new Discord.ButtonBuilder()
                .setCustomId(`${i}`)
                .setStyle(4)
                .setLabel('🟥')
            buttons.push(button)
        }

        let actionRows = []
        for (let i = 0; i < 3; i++) {
            let actionRow = new Discord.ActionRowBuilder().addComponents([
                buttons[i * 3],
                buttons[i * 3 + 1],
                buttons[i * 3 + 2]
            ])
            actionRows.push(actionRow)
        }
        actionRows.push(new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder().setCustomId('solve').setStyle(1).setLabel('Solve'),
            new Discord.ButtonBuilder().setCustomId('reset').setStyle(2).setLabel('Reset')
        ]))

        let puzzle = [[false, false, false], [false, false, false], [false, false, false]]

        let reply = await message.reply({ embeds: [embed], ephemeral, components: actionRows })

        let collector = reply.createMessageComponentCollector({ time: 300000, filter: interaction => interaction.user.id == message.author.id })
        collector.on('collect', async interaction => {
            if (interaction.customId == 'solve') {
                collector.stop()
                let solution = new Set(lightsOutSolver(puzzle))
                // use red and green buttons to show solution
                embed.setDescription(`Solution:
                ${solution.has(0) ? '🟪' : puzzle[0][0] ? '🟩' : '🟥'} ${solution.has(1) ? '🟪' : puzzle[0][1] ? '🟩' : '🟥'} ${solution.has(2) ? '🟪' : puzzle[0][2] ? '🟩' : '🟥'}
                ${solution.has(3) ? '🟪' : puzzle[1][0] ? '🟩' : '🟥'} ${solution.has(4) ? '🟪' : puzzle[1][1] ? '🟩' : '🟥'} ${solution.has(5) ? '🟪' : puzzle[1][2] ? '🟩' : '🟥'}
                ${solution.has(6) ? '🟪' : puzzle[2][0] ? '🟩' : '🟥'} ${solution.has(7) ? '🟪' : puzzle[2][1] ? '🟩' : '🟥'} ${solution.has(8) ? '🟪' : puzzle[2][2] ? '🟩' : '🟥'}`)
                return interaction.update({ embeds: [embed], components: [] })
            }
            if (interaction.customId == 'reset') {
                puzzle = [[false, false, false], [false, false, false], [false, false, false]]
                buttons.forEach(button => button.setStyle(4).setLabel('R'))
                return interaction.update({ components: actionRows })
            }
            let move = parseInt(interaction.customId)
            let i = Math.floor(move / 3), j = move % 3
            puzzle[i][j] = !puzzle[i][j]
            buttons[move].setStyle(puzzle[i][j] ? 3 : 4).setLabel(puzzle[i][j] ? '🟩' : '🟥')
            await interaction.update({ components: actionRows })
        })
    }
}

function toggle(grid, x, y) {
    if (x >= 0 && x < 3 && y >= 0 && y < 3) {
        grid[x][y] = !grid[x][y];
    }
}

function applyMove(grid, move) {
    let x = Math.floor(move / 3);
    let y = move % 3;

    toggle(grid, x, y); // Toggle clicked cell
    toggle(grid, x - 1, y); // Toggle above
    toggle(grid, x + 1, y); // Toggle below
    toggle(grid, x, y - 1); // Toggle left
    toggle(grid, x, y + 1); // Toggle right
}

function isSolved(grid) {
    // Check if all lights are on instead of off
    return grid.every(row => row.every(cell => cell));
}

function copyGrid(grid) {
    return grid.map(row => row.slice());
}

function lightsOutSolver(originalGrid) {
    for (let i = 0; i < (1 << 9); i++) {
        let grid = copyGrid(originalGrid);
        let moveList = [];

        for (let j = 0; j < 9; j++) {
            if (i & (1 << j)) {
                moveList.push(j);
                applyMove(grid, j);
            }
        }

        if (isSolved(grid)) {
            return moveList;
        }
    }

    return []; // Return an empty array if no solution is found
}