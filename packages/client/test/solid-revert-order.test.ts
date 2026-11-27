import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createData, type CreateDataInput } from "../src/solid"
import { OpenCode, type OpenCodeEvent } from "../src/promise"

// A steered prompt is admitted with an early id, then delivered after the assistant turn it waited behind keeps the
// transcript out of id order. A revert committed at that prompt must drop only what follows it in the transcript.
const sessionID = "ses_revert_order"

function fixture() {
  const listeners = new Set<Parameters<CreateDataInput["event"]["listen"]>[0]>()
  const api = OpenCode.make({
    baseUrl: "http://opencode.local",
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      return request.method === "GET" ? Response.json({ data: [] }) : Response.json({ data: {} })
    },
  })
  let seq = 0
  return createRoot((dispose) => {
    const data = createData({
      api: () => api,
      directory: "/project",
      event: {
        on: () => () => {},
        listen(handler) {
          listeners.add(handler)
          return () => listeners.delete(handler)
        },
      },
    })
    const emit = (type: string, payload: Record<string, unknown> = {}) => {
      seq++
      const event = {
        id: `evt_${seq}`,
        type,
        created: seq,
        durable: { aggregateID: sessionID, seq, version: 1 },
        data: { sessionID, ...payload },
      } as OpenCodeEvent
      listeners.forEach((listener) => listener({ name: event.type, details: event }))
    }
    return { data, dispose, emit, ids: () => data.session.message.list(sessionID).map((message) => message.id) }
  })
}

test("a committed revert truncates at the transcript position, not the id order", () => {
  const { data, emit, ids, dispose } = fixture()
  try {
    emit("session.inbox.enqueued", {
      inboxID: "msg_2",
      item: { type: "user", delivery: "steer", payload: { text: "steer" } },
    })
    emit("session.step.started", {
      started: 2,
      assistantMessageID: "msg_3",
      agent: "build",
      model: { providerID: "provider", id: "model" },
    })
    expect(ids()).toEqual(["msg_2", "msg_3"])

    // Delivery moves the earlier-id prompt behind the assistant turn.
    emit("session.inbox.delivered", { inboxID: "msg_2" })
    expect(ids()).toEqual(["msg_3", "msg_2"])

    // Taking that prompt back keeps the turn it waited behind. By id order `msg_3 >= msg_2`, so the naive scan
    // removed both.
    emit("session.revert.committed", { to: "msg_2" })
    expect(ids()).toEqual(["msg_3"])
    expect(data.session.message.list(sessionID)).toHaveLength(1)
  } finally {
    dispose()
  }
})
