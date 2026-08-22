import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.SDE_BASE_URL;
const localBaseURL = 'http://127.0.0.1:4173/';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'line',
  webServer: externalBaseURL ? undefined : {
    command: 'python3 -m http.server 4173',
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 15_000
  },
  use: {
    baseURL: externalBaseURL || localBaseURL,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'iphone-webkit',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 13']
      }
    }
  ]
});