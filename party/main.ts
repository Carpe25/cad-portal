import type * as Party from "partykit/server"

export default class TaskChatServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    this.broadcastActiveCount()
  }

  onClose(conn: Party.Connection) {
    this.broadcastActiveCount()
  }

  private broadcastActiveCount() {
    const activeCount = Array.from(this.room.getConnections()).length
    this.room.broadcast(
      JSON.stringify({
        type: "presence",
        activeCount,
      })
    )
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message)

      if (data.type === "chat_message") {
        // Broadcast the new message to everyone viewing this task room in real time
        this.room.broadcast(
          JSON.stringify({
            type: "chat_message",
            message: data.message,
          })
        )
      }
    } catch (err) {
      console.error("PartyKit onMessage error:", err)
    }
  }
}

TaskChatServer satisfies Party.Worker
