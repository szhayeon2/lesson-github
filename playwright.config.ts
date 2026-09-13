import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'e2e',use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure'},webServer:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI},projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:375,height:812}}}]});
