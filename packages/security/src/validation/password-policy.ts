import type {
  SecurityValidationIssue
} from "./security-validation-error";

export interface PasswordPolicyOptions {
  minimumLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
}

export const defaultPasswordPolicy:
  PasswordPolicyOptions = {
    minimumLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true
  };

export function validatePassword(
  password: string,
  options: PasswordPolicyOptions =
    defaultPasswordPolicy
): SecurityValidationIssue[] {
  const issues: SecurityValidationIssue[] = [];

  if (password.length < options.minimumLength) {
    issues.push({
      field: "password",
      message:
        `رمز عبور باید حداقل ${options.minimumLength} نویسه داشته باشد.`
    });
  }

  if (
    options.requireUppercase &&
    !/[A-Z]/.test(password)
  ) {
    issues.push({
      field: "password",
      message:
        "رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد."
    });
  }

  if (
    options.requireLowercase &&
    !/[a-z]/.test(password)
  ) {
    issues.push({
      field: "password",
      message:
        "رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد."
    });
  }

  if (
    options.requireDigit &&
    !/\d/.test(password)
  ) {
    issues.push({
      field: "password",
      message:
        "رمز عبور باید حداقل یک عدد داشته باشد."
    });
  }

  return issues;
}
