const WS = require('ws')
const EventHandler = require('events')

class DiscordWebsocket extends EventHandler {
  constructor (shard) {
    super()
    this.shard = shard
    this.client = shard.client

    this.ws = null

    this.hbInterval = null
    this.s = null
    this.sessionID = null

    this.reconnecting = false

    this.setup()
  }

  setup () {
    this.ws = new WS(this.client.options.ws.url)

    this.ws.on('message', (data) => {
      this.message(data)
    })
    this.ws.on('open', () => {
      this.open()
    })
    this.ws.on('close', () => {
      this.close()
    })
  }

  message (data) {
    const msg = JSON.parse(data)
    if (msg.s) this.s = msg.s

    if (msg.t === 'READY') this.sessionID = msg.d.session_id
    if (['GUILD_CREATE', 'READY'].includes(msg.t)) return this.emit(msg.t, msg.d)

    this.client.emit(msg.t, msg.d || msg, this)

    if (msg.op === 10) this.hello(msg)
    if (msg.op === 11) this.ack()
  }

  open () {
    this.client.log(9, 9, this.shard.id)
  }

  close () {
    this.client.log(9, 10, this.shard.id)
    clearInterval(this.hbInterval)
    this.reconnect()
  }

  hello (msg) {
    if (this.reconnecting) {
      this.sendRaw({
        op: 6,
        d: {
          token: this.client.token,
          session_id: this.sessionID,
          seq: this.s
        }
      })
    } else {
      this.sendRaw({
        op: 2,
        d: {
          shard: [this.shard.id, this.client.options.shardCount],
          token: this.client.token,
          properties: {
            $os: 'linux',
            $browser: 'censor bot',
            $device: 'bot'
          }
        }
      })
    }
    this.hbInterval = setInterval(this.heartbeat.bind(this), msg.d.heartbeat_interval)
    this.heartbeat()
  }

  heartbeat () {
    if (this.waitingHeartbeat) { console.error(`Shard ${this.shard.id} heartbeat took too long`) };
    this.sendRaw({
      op: 1,
      d: this.s
    })
    this.waitingHeartbeat = new Date().getTime()
  }

  ack () {
    const cur = new Date().getTime() - this.waitingHeartbeat
    this.shard.ping = cur
    this.waitingHeartbeat = false
  }

  sendRaw (data) {
    this.ws.send(
      JSON.stringify(
        data
      )
    )
  }

  send (event, data) {
    this.sendRaw({
      t: event,
      d: data
    })
  }

  kill () {
    this.ws.close()
  }

  reconnect () {
    this.reconnecting = true
    this.client.log(5, 11, this.shard.id)
    this.setup()
  }
}

module.exports = DiscordWebsocket