const isDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const SERVER_URL = "https://v1.mypayrollmaster.online";

const API_BASE_URL = isDevelopment
    ? "/api"
    : `${SERVER_URL}/api/v2qa`;

export default API_BASE_URL;
