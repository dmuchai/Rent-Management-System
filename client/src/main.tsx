import { createRoot } from "react-dom/client";
import App from "./App";
import { registerNativeOAuthHandler } from "@/lib/nativeOAuth";
import "./index.css";

registerNativeOAuthHandler();

createRoot(document.getElementById("root")!).render(<App />);
