import axios from "axios";

// Empty string => same-origin ("/api"), which is how the production build is
// served (frontend and backend behind one reverse proxy). Falls back to the
// env var for split local dev.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API });
