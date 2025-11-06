import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/puyo-react/", // ← GitHub Pages のサブパス: /<ユーザー名>/<リポジトリ>/
});
