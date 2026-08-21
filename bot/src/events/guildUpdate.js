const { isBotUsable } = require('../utils/premium');
const { handleVanityChange } = require('../utils/antinuke');

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    if (!isBotUsable(newGuild.id)) return;
    await handleVanityChange(oldGuild, newGuild);
  },
};
