const faPartyErrorMessages: Readonly<Record<string, string>> = Object.freeze({
  "party.notFound": "شخص موردنظر پیدا نشد.",
  "party.id.conflict": "شناسه داخلی شخص قبلاً برای اطلاعات دیگری استفاده شده است.",
  "party.code.conflict": "کد شخص در این شرکت تکراری است.",
  "party.identity.conflict": "شناسه رسمی واردشده قبلاً برای شخص دیگری ثبت شده است.",
  "party.classification.mismatch": "نوع شخص در ویرایش قابل تغییر نیست.",
  "party.concurrentModification": "اطلاعات توسط کاربر دیگری تغییر کرده است. صفحه را تازه‌سازی کنید و دوباره تلاش کنید.",
  "party.permissionDenied": "مجوز انجام این عملیات را ندارید.",
  "party.invalidQuery": "فیلتر یا صفحه‌بندی اشخاص معتبر نیست.",

  "party.id.required": "شناسه داخلی شخص الزامی است.",
  "party.companyId.required": "شرکت مربوط به شخص مشخص نشده است.",
  "party.code.required": "کد شخص الزامی است.",
  "party.firstName.required": "نام شخص الزامی است.",
  "party.lastName.required": "نام خانوادگی شخص الزامی است.",
  "party.legalName.required": "نام حقوقی شرکت یا مؤسسه الزامی است.",
  "party.createdAt.invalid": "تاریخ ایجاد شخص معتبر نیست.",
  "party.updatedAt.invalid": "تاریخ آخرین تغییر معتبر نیست.",
  "party.updatedAt.beforeCurrent": "زمان تغییر جدید نمی‌تواند قبل از آخرین تغییر ثبت‌شده باشد.",
  "party.role.invalid": "نقش انتخاب‌شده برای شخص معتبر نیست.",
  "party.contact.duplicateId": "شناسه یکی از اطلاعات تماس تکراری است.",
  "party.contact.multiplePrimary": "برای یک نوع و کاربرد تماس، فقط یک مقدار می‌تواند اصلی باشد.",
  "party.address.duplicateId": "شناسه یکی از نشانی‌ها تکراری است.",
  "party.address.multiplePrimary": "برای هر نوع نشانی فقط یک نشانی می‌تواند اصلی باشد.",

  "party.identity.nationalCode.invalid": "کد ملی واردشده معتبر نیست.",
  "party.identity.nationalId.invalid": "شناسه ملی شخص حقوقی معتبر نیست.",
  "party.identity.registrationNumber.invalid": "شماره ثبت باید فقط شامل رقم باشد و حداکثر ۲۰ رقم داشته باشد.",
  "party.identity.economicNumber.invalid": "شماره اقتصادی واردشده از نظر تعداد یا قالب ارقام معتبر نیست.",
  "party.identity.economicNumber.mismatch": "شماره اقتصادی با کد ملی یا شناسه ملی واردشده تطابق ندارد.",
  "party.identity.legacyEconomicCode.invalid": "کد اقتصادی قدیم باید دقیقاً ۱۲ رقم باشد.",
  "party.identity.taxFileNumber.invalid": "شماره پرونده مالیاتی باید فقط شامل رقم باشد.",

  "party.contact.id.required": "شناسه اطلاعات تماس الزامی است.",
  "party.contact.type.invalid": "نوع اطلاعات تماس معتبر نیست.",
  "party.contact.purpose.invalid": "کاربرد اطلاعات تماس معتبر نیست.",
  "party.contact.value.invalid": "اطلاعات تماس واردشده معتبر نیست؛ تلفن، موبایل، ایمیل یا وب‌سایت را بررسی کنید.",

  "party.address.id.required": "شناسه نشانی الزامی است.",
  "party.address.purpose.invalid": "نوع نشانی معتبر نیست.",
  "party.address.line.required": "متن نشانی الزامی است.",
  "party.address.postalCode.invalid": "کدپستی باید دقیقاً ۱۰ رقم باشد.",

  "party.profile.classification.mismatch": "نوع شخص در ویرایش قابل تغییر نیست.",
});

interface CodedError {
  readonly code: unknown;
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as CodedError).code;
  return typeof code === "string" ? code : null;
}

export function getPartyErrorMessage(error: unknown, locale = "fa-IR"): string {
  const code = readErrorCode(error);

  if (locale === "fa-IR" && code !== null) {
    const translated = faPartyErrorMessages[code];
    if (translated) return translated;
  }

  if (locale === "fa-IR") {
    return "اطلاعات واردشده معتبر نیست یا انجام عملیات با خطا مواجه شد. لطفاً مقادیر فرم را بررسی کنید و دوباره تلاش کنید.";
  }

  return error instanceof Error ? error.message : "Unexpected error.";
}

export function hasPartyErrorTranslation(code: string, locale = "fa-IR"): boolean {
  return locale === "fa-IR" && Object.prototype.hasOwnProperty.call(faPartyErrorMessages, code);
}
