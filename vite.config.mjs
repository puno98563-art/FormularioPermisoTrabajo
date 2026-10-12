import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "escape-inline-js-control-characters",
      enforce: "pre",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, (character) =>
            `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
          );
        },
      },
    },
  ],
});
