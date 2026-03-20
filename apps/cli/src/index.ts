import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "vxllm",
    version: "0.1.0",
    description: "VxLLM — Local AI Model Server",
  },
  subCommands: {
    serve: () => import("./commands/serve").then((m) => m.default),
    pull: () => import("./commands/pull").then((m) => m.default),
    run: () => import("./commands/run").then((m) => m.default),
    list: () => import("./commands/list").then((m) => m.default),
    ps: () => import("./commands/ps").then((m) => m.default),
    rm: () => import("./commands/rm").then((m) => m.default),
    info: () => import("./commands/info").then((m) => m.default),
  },
});

runMain(main);
