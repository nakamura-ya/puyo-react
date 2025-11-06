import React from "react";
import { createRoot } from "react-dom/client";
import PuyoPuyo from "./PuyoPuyo.jsx";
// import "./styles.css"; // 必要ならスタイル用

const root = createRoot(document.getElementById("root"));
root.render(<PuyoPuyo />);
