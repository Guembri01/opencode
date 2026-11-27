import { appendFileSync } from "node:fs"

// Records setup and cleanup in a server plugin; the test asserts cleanup ran before the server exited.
export default {
  id: "probe.cleanup",
  async setup() {
    appendFileSync(process.env.CLEANUP_FILE, "setup\n")
    return async () => {
      appendFileSync(process.env.CLEANUP_FILE, "cleanup-start\n")
      await new Promise((resolve) => setTimeout(resolve, 10))
      appendFileSync(process.env.CLEANUP_FILE, "cleanup-end\n")
    }
  },
}
