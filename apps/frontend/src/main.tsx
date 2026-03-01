import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const app = <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  import.meta.env.DEV ? app : <React.StrictMode>{app}</React.StrictMode>
);
