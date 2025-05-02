import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/promise-patch.ts"],
  target: "node20.18",
  clean: true,
  dts: true,
  platform: "neutral",
});
