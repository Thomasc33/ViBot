const { ShardingManager } = require('discord.js')
const token = require('./botKey.json').key

const shards = new ShardingManager('./index.js', {
    token: token,
    totalShards: 2
})

shards.on('shardCreate', shard => {
    console.log('Shard Created: ', shard.id)
})

shards.spawn(shards.totalShards, 10000)