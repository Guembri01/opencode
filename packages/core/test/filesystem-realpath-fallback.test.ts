import fs from "fs/promises"
import path from "path"
import { expect } from "bun:test"
import { Effect, Exit, Layer, PlatformError } from "effect"
import { FSUtil } from "@opencode/util/fs-util"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { FileSystem } from "@opencode/core/filesystem"
import { Location } from "@opencode/core/location"
import { AbsolutePath } from "@opencode/core/schema"
import { location } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const withTmp = <A, E, R>(f: (directory: string) => Effect.Effect<A, E, R>) =>
  tmpdirScoped().pipe(Effect.flatMap((tmp) => f(tmp.path)))

const boot = (directory: string, filesystem: FSUtil.Interface) =>
  FileSystem.Service.pipe(
    Effect.provide(
      LayerNode.compile(FileSystem.node, {
        replacements: [
          Location.node.replace(
            Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(directory) })),
          ),
          FSUtil.node.replace(Layer.succeed(FSUtil.Service, filesystem)),
        ],
      }),
    ),
  )

// A Windows filter driver can fail native realpath with ENOENT for a path it can open (DriveCrypt, #64905). Boot
// falls back to the lexical path instead of reporting the directory missing.
it.live("boots a location whose native realpath reports ENOENT", () =>
  withTmp((directory) =>
    Effect.gen(function* () {
      yield* Effect.promise(() => fs.writeFile(path.join(directory, "note.txt"), "hello"))
      const filesystem = yield* FSUtil.Service
      const missing = PlatformError.systemError({
        _tag: "NotFound",
        module: "FileSystem",
        method: "realPath",
        pathOrDescriptor: directory,
        cause: Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      })
      const result = yield* boot(directory, {
        ...filesystem,
        realPath: (target) => (target === directory ? Effect.fail(missing) : filesystem.realPath(target)),
      }).pipe(Effect.exit)
      expect(Exit.isSuccess(result)).toBe(true)
    }).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  ),
)
