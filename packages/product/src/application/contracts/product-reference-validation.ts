export interface TaxpayerUnitReferenceValidator {
  isActiveCode(code: string): Promise<boolean>;
}
