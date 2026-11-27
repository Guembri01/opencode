import { Effect } from "effect"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/effect/service"
import path from "node:path"
import { Standalone } from "../../src/services/standalone"

process.chdir(path.join(import.meta.dir, "../../../.."))

// An owner that starts a standalone server, waits for its plugin to be loaded, then exits normally: the server must
// get the chance to run that plugin's cleanup instead of being killed by the spawner's teardown.
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const endpoint = yield* Standalone.start({
        command: [process.execPath, path.join(import.meta.dir, "../../src/index.ts"), "serve"],
      })
      const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })
      yield* Effect.promise(async () => {
        for (let attempt = 0; attempt < 200; attempt++) {
          const listed = await client.plugin
            .list({ location: { directory: process.cwd() } })
            .catch(() => undefined)
          if (listed?.data?.some((plugin) => plugin.id === "probe.cleanup")) return
          await Bun.sleep(100)
        }
        throw new Error("probe plugin never loaded")
      })
      console.log("STANDALONE_READY")
    }),
  ),
)
