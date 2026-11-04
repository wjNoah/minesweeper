/** Settings for npm start. Replaces environment.ts (see fileReplacements in angular.json). */
export const environment = {
  /** The relay running on this computer: cd relay && npx wrangler@4 dev */
  relayUrl: `ws://${location.hostname}:8787`,
};
