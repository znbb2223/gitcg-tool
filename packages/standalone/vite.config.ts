// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { defineConfig } from "vite";
import gts from "@gi-tcg/unplugin-gts/rolldown";
import solid from "@solidjs/vite-plugin";
import babel from "@rollup/plugin-babel";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  resolve: {
    alias: {
      "solid-js/web": "@solidjs/web",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        lab: "lab.html",
        deckbuilder: "deck-builder.html",
        aisettings: "ai-settings.html",
        stateeditor: "state-editor.html",
        hub: "hub.html",
        decklibrary: "deck-library.html",
      },
    },
  },
  esbuild: {
    target: "ES2020",
    supported: {
      using: false,
    },
  },
  plugins: [
    gts(),
    solid(),
    babel({
      babelHelpers: "bundled",
    }),
    viteStaticCopy({
      watch: null,
      silent: true,
      targets: [
        {
          src: "../data-code-analyzer/src/result.json",
          rename: "data-code-analyze-result.json",
          dest: "."
        }
      ]
    })
  ],
});
