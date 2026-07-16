export interface DatabaseHealth {
  isConnected: boolean;
  provider: string;
  databaseVersion: string;
  foreignKeysEnabled: boolean;
  checkedAt: string;
}
