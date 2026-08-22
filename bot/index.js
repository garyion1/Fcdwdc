require('dotenv').config();

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in environment. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// Discord refuses a single gateway connection above 2,500 guilds, so past
// that point a bot MUST run sharded — it isn't a tuning knob, it's a hard
// limit. This file therefore runs in one of two modes:
//
//   manager — spawns one child process per shard and supervises them
//   shard   — an actual bot client, one slice of the guilds
//
// ShardingManager sets SHARDING_MANAGER in the children it spawns, which is
// how a child knows it's the bot and not another manager.
//
// totalShards: 'auto' asks Discord how many are needed, so a small bot gets
// exactly one shard and nothing changes; crossing 2,500 guilds starts a
// second one on its own with no config edit.
//
// Set SHARDING=off to skip the manager entirely and run a single bare client
// (one less process, fine below ~2,000 guilds and on very small hosts).
const isShardChild = Boolean(process.env.SHARDING_MANAGER);
const shardingEnabled = (process.env.SHARDING ?? 'auto').toLowerCase() !== 'off';

let client = null;

if (!isShardChild && shardingEnabled) {
  const { ShardingManager } = require('discord.js');

  const manager = new ShardingManager(__filename, {
    token: process.env.DISCORD_TOKEN,
    totalShards: process.env.SHARD_COUNT ? Number(process.env.SHARD_COUNT) : 'auto',
    respawn: true,
  });

  manager.on('shardCreate', (shard) => {
    console.log(`Launched shard ${shard.id}.`);
    shard.on('death', () => console.error(`Shard ${shard.id} died — respawning.`));
  });

  manager
    .spawn()
    .then((shards) => console.log(`Sharding manager running ${shards.size} shard(s).`))
    .catch((error) => {
      console.error('Failed to spawn shards:', error);
      process.exit(1);
    });
} else {
  client = require('./src/bot').startBot();
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

module.exports = { client };
