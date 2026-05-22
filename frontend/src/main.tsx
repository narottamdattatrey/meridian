import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Bootstrap 5 theme – variables overridden first, then full Bootstrap SCSS
import "./styles/theme.scss";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in index.html.");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
