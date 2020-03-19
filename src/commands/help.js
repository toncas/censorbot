exports.run = function (message, args) {
  this.delete()
  let helpstring = ''
  const cmds = this.client.commands.list()
  for (var i = 0; i < cmds.length; i++) {
    helpstring += `__${this.config.prefix[0]}${cmds[i].name}__: ${cmds[i].description.replace('{name}', this.client.user.username).replace('{prefix}', this.config.prefix[0])}\n`
  }
  this.send(this.embed
    .description(helpstring)
    .color('BLURPLE')
    .field('Links', `[Support Server](${this.config.support}) | [Patreon](${this.config.patreon}) | [Website](${this.config.website})
        [Invite](${this.config.inviteSite}) | [Dashboard](${this.client.dash.base}) | [Discord Bot List](https://top.gg/bot/${this.client.user.id})`)
    .title('Hello and Thank You For Using ' + this.client.user.username + '!')
  )
}
exports.info = {
  name: 'help',
  description: 'Displays this list',
  format: '{prefix}help',
  aliases: ['h', 'ayuda']
}
