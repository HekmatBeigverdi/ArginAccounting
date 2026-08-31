import {
  ProductApplicationError,
  ProductDomainError,
} from "@argin/product";

const messages: Readonly<Record<string, string>> = Object.freeze({
  "product.application.invalid-request": "اطلاعات واردشده کامل یا معتبر نیست.",
  "product.application.not-found": "کالا یا خدمت موردنظر یافت نشد.",
  "product.application.code-conflict": "این کد قبلاً برای کالا یا خدمت دیگری استفاده شده است.",
  "product.application.duplicate-identifier": "یکی از شناسه‌های واردشده با رکورد دیگری تداخل دارد.",
  "product.application.concurrency-conflict": "این رکورد هم‌زمان توسط فرایند دیگری تغییر کرده است. اطلاعات را تازه‌سازی و دوباره تلاش کنید.",
  "product.application.unauthorized": "مجوز انجام این عملیات را ندارید.",
  "product.application.taxpayer-unit-reference-invalid": "کد واحد سامانه مودیان در فهرست مرجع فعال وجود ندارد.",
  "product.application.unit-reference-invalid": "واحد پیش‌فرض انتخاب‌شده در واحدهای همین کالا/خدمت وجود ندارد.",
  "product.code.required": "کد کالا/خدمت الزامی است.",
  "product.title.required": "عنوان کالا/خدمت الزامی است.",
  "product.taxpayer-goods-service-id.invalid": "شناسه کالا/خدمت سامانه مودیان باید دقیقاً ۱۳ رقم باشد.",
  "product.service-stock-tracking.invalid": "برای خدمت امکان ردیابی موجودی، سریال، بچ یا عمر انبارش وجود ندارد.",
  "product.unit.invalid": "اطلاعات واحد اندازه‌گیری معتبر نیست.",
  "product.unit.duplicate": "کد یا شناسه واحد اندازه‌گیری تکراری است.",
  "product.unit.precision.invalid": "دقت اعشار واحد باید عدد صحیح بین صفر تا شش باشد.",
  "product.unit.taxpayer-code.invalid": "کد واحد سامانه مودیان معتبر نیست.",
  "product.vat-rate.invalid": "نرخ مالیات بر ارزش افزوده معتبر نیست.",
});

export function getProductErrorMessage(error: unknown): string {
  if (error instanceof ProductApplicationError || error instanceof ProductDomainError) {
    return messages[error.code] ?? "اطلاعات کالا/خدمت با قواعد سیستم سازگار نیست.";
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : "خطای پیش‌بینی‌نشده‌ای رخ داد.";
}
