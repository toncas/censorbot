import { Utils } from './Utils'
import { Logger } from './Logger'

import { E } from './Elements'

export class CensorBotApi {
  public user: User
  public guilds: ShortGuild[]
  private waitingForUser: Function[]
  constructor () {
    this.waitingForUser = []

    this.loginButton.onclick = () => {
      if (this.user) document.getElementById('menu').toggleAttribute('hidden')
      else this.auth()
    }

    window.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).matches('#login')) document.getElementById('menu').setAttribute('hidden', '')
    })

    document.getElementById('logout').onclick = () => {
      this.logout()
    }

    this.fetch()
  }

  public get loginButton () {
    return document.getElementById('login')
  }

  private async fetch (): Promise<boolean> {
    let user
    if (this.token) {
      user = await this.getSelf()
    }
    this.user = user
    if (!user) {
      this.loginButton.innerText = 'Login'
      this.loginButton.removeAttribute('loggedin')
      return false
    } else {
      this.loginButton.innerText = `${this.user.tag}`
      this.loginButton.setAttribute('loggedin', '')
      if (this.user.admin) document.querySelectorAll('.adminshow').forEach(e => e.removeAttribute('hidden'))
      else document.querySelectorAll('.adminshow').forEach(e => e.setAttribute('hidden', ''))
      if (this.waitingForUser) this.waitingForUser.forEach(x => x())
      return true
    }
  }

  /**
   * Current API Base Endpoint
   */
  static get url (): string {
    return `${window.location.protocol}//${window.location.hostname}/api`
  }

  /**
   * Gets token
   */
  get token () {
    var name = 'token='
    var ca = document.cookie.split(';')
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i]
      while (c.charAt(0) === ' ') {
        c = c.substring(1)
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length)
      }
    }
  }

  private _formUrl (url: string): string {
    return CensorBotApi.url + url
  }

  private async request (message: false|string, method: string, url: string, body?: object, returnErrors?: number): Promise<any|false> {
    if (message) Utils.presentLoad(message)

    const headers = new Headers()

    if (method !== 'GET') headers.set('Content-Type', 'application/json')
    if (this.token) headers.set('Authorization', this.token)

    const req = await fetch(this._formUrl(url), {
      method,
      headers,
      body: method !== 'GET' && body ? JSON.stringify(body) : null
    })

    const response = await req.json()

    if (message) Utils.stopLoad()

    if (!req.ok && !(returnErrors && returnErrors === req.status)) {
      if (response.error) Logger.tell('Error: ' + response.error)
      Logger.log('API', `Error from ${url}: ${req.status} / ${req.statusText} = ${response.error}`)
      if (req.status === 401) {
        const auth = await this.auth(true)
        if (!auth) return false
        return this.request(message, method, url, body, returnErrors)
      }
      return false
    }

    return response
  }

  private async logout (redir: boolean = true) {
    await this.request(null, 'DELETE', '/auth')

    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    this.guilds = null

    if (redir && window.location.pathname !== '/') Utils.setPath()

    this.fetch()
  }

  public async auth (required?: boolean): Promise<boolean> {
    Utils.presentLoad('Waiting for you to authorize...')
    await this.logout(false)

    await Utils.openWindow(this._formUrl('/auth' + (window.discordOAuthExtra || '')), 'Login')

    if (!this.token) {
      if (required) {
        if (confirm('Failed the authorize, try again?')) return this.auth(true)
        else {
          setTimeout(() => {
            Utils.setPath()
          }, 100)
        }
      } else Logger.tell('Failed to authorize')
      Utils.stopLoad()
      return false
    }

    Utils.presentLoad('Logging you in...')

    const fet = await this.fetch()

    Utils.stopLoad()

    return fet
  }

  async waitForUser (): Promise<void> {
    return new Promise(resolve => {
      if (this.user || !this.waitingForUser) resolve()
      this.waitingForUser.push(() => resolve())
      if (!this.token) this.auth(true)
    })
  }

  public async getSelf (): Promise<User> {
    return this.request(false, 'GET', '/users/@me')
  }

  public async getGuilds (): Promise<ShortGuild[]|false> {
    if (!this.token && !await this.auth(true)) return false

    if (this.guilds) return this.guilds

    const result = await this.request('Fetching servers', 'GET', '/guilds')
    if (!result) return false

    this.guilds = result

    return result
  }

  public async getGuild (id: Snowflake): Promise<GuildData|false> {
    if (!this.token && !await this.auth(true)) return false

    const guild = await this.request('Fetching server', 'GET', `/guilds/${id}`, null, 404)
    if (!guild) return false

    if (guild.error === 'Not In Guild') {
      Utils.presentLoad(E.create({
        elm: 'div',
        children: [
          { elm: 'text', text: 'Not in server.' },
          { elm: 'br' },
          { elm: 'br' },
          {
            elm: 'a',
            text: 'Back',
            classes: ['button'],
            events: {
              click: () => {
                Utils.stopLoad(),
                Utils.setPath('/dashboard')
              }
            }
          },
          { elm: 'br' },
          { elm: 'br' },
          {
            elm: 'a',
            text: 'Invite',
            classes: ['button'],
            attr: {
              special: ''
            },
            events: {
              click: async () => {
                await Utils.openWindow(this._formUrl('/invite?id=' + id), 'Invite')
                Utils.reloadPage()
              }
            }
          }
        ]
      }) as HTMLElement)
      return false
    }
    return guild
  }

  public async postSettings (id: Snowflake, data: GuildDB): Promise<GuildDB|false> {
    if (!this.token && !await this.auth(true)) return false

    return this.request('Saving...', 'POST', `/guilds/${id}`, data)
  }

  public async postPremium (guilds: Snowflake[]): Promise<Snowflake[]|false> {
    if (!this.token && !await this.auth(true)) return false

    const response = await this.request('Setting premium servers', 'POST', '/users/@me/premium', { guilds })

    if (response) this.user.premium.guilds = response
    return response
  }

  public async getStats (show?: boolean): Promise<AdminResponse|false> {
    if (!this.token && !await this.auth(true)) return false

    let response
    if (this.user.admin) {
      response = await this.request(show ? 'Fetching statuses' : null, 'GET', '/admin', null, 401)
      if (!response) return false
    }

    if (!this.user.admin || response.error === 'Unauthorized') {
      Logger.tell('You are not authorized to access this location.')
      setTimeout(() => {
        Utils.setPath()
      }, 1000)
      return false
    }

    return response
  }

  public async restartShard(id: number): Promise<any> {
    if (!this.token && !await this.auth(true)) return false

    let response
    if (this.user.admin) {
      response = await this.request(null, 'DELETE', '/admin/shards/' + id, null, 401)
    }

    if (!response) return false
  }

  public async getTickets (): Promise<Ticket[]|false> {
    if (!this.token && !await this.auth(true)) return false
    let response
    if (this.user.admin) {
      response = await this.request('Fetching tickets', 'GET', '/admin/tickets', null, 401)
      if (!response) return false
    }

    if (!this.user.admin || response.error === 'Unauthorized') {
      Logger.tell('You are not authorized to access this location.')
      setTimeout(() => {
        Utils.setPath()
      }, 1000)
      return false
    }

    return response
  }

  public async testTicket (id: SmallID): Promise<TicketTest> {
    if (this.user.admin) return this.request('Fetching ticket', 'GET', '/admin/tickets/' + id)
  }

  public async acceptTicket (id: SmallID): Promise<{ success: boolean }> {
    if (this.user.admin) return this.request('Accepting ticket', 'POST', '/admin/tickets/' + id)
  }

  public async denyTicket (id: SmallID): Promise<{ success: boolean }> {
    if (this.user.admin) return this.request('Denying ticket', 'DELETE', '/admin/tickets/' + id)
  }
}