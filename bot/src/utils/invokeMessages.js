function renderTemplate(template, ctx) {
  return template
    .replace(/{user\.name}/g, ctx.user.tag)
    .replace(/{user\.id}/g, ctx.user.id)
    .replace(/{user}/g, `<@${ctx.user.id}>`)
    .replace(/{moderator}/g, ctx.moderator.tag)
    .replace(/{reason}/g, ctx.reason ?? 'No reason provided')
    .replace(/{server}/g, ctx.guild.name)
    .replace(/{duration}/g, ctx.duration ?? '');
}

// Returns the server's custom text for a moderation command, or null to let the
// command fall back to its built-in wording.
function invokeText(config, command, mode, ctx) {
  const template = config.invokeMessages?.[command]?.[mode];
  if (!template) return null;
  return renderTemplate(template, ctx);
}

module.exports = { invokeText, renderTemplate };
