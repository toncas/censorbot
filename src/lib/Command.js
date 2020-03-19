class Command {
  constructor (client, message) {
    this.client = client
    this.msg = message
  }

  get config () {
    return this.client.config
  }

  get embed () {
    return this.client.embed
  }

  send (content) {
    return this.client.sendMessage(this.msg.channel_id, content)
  }

  delete () {
    return this.client.deleteMessage(this.msg.channel_id, this.msg.id)
  }
}

module.exports = Command
