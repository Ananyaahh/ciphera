import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aryakelychankandy.ciphera",
  appName: "Ciphera",
  webDir: "out",
  server: {
    hostname: "localhost",
    iosScheme: "https",
  },
};

export default config;