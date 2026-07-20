import {
  invoke
} from "@tauri-apps/api/core";

import type {
  PasswordHasher
} from "@argin/security";

export class TauriPasswordHasher
  implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return invoke<string>("hash_password", {
      password
    });
  }

  async verify(
    password: string,
    passwordHash: string
  ): Promise<boolean> {
    return invoke<boolean>("verify_password", {
      password,
      passwordHash
    });
  }
}
