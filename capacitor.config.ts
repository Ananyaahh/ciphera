import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aryakelychankandy.ciphera",
  appName: "Ciphera",
  webDir: "public",
  server: {
    url: "https://ciphera-app.vercel.app",
    cleartext: false,
  },
};

export default config;