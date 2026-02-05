// Kenya Bank Paybill Numbers and Configuration
// Used for M-Pesa to Bank payments

export const KENYA_BANK_PAYBILLS = {
  FAMILY_BANK: {
    name: "Family Bank",
    paybill: "222111",
    accountFormat: /^\d{10,13}$/,  // 10-13 digit account numbers
  },
  EQUITY_BANK: {
    name: "Equity Bank",
    paybill: "247247",
    accountFormat: /^\d{12}$/,  // 12 digit account numbers
  },
  KCB_BANK: {
    name: "KCB Bank",
    paybill: "522522",
    accountFormat: /^\d{12}$/,  // 12 digit account numbers
  },
  COOPERATIVE_BANK: {
    name: "Co-operative Bank",
    paybill: "400200",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
  NCBA_BANK: {
    name: "NCBA Bank",
    paybill: "720720",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
  ABSA_BANK: {
    name: "Absa Bank Kenya",
    paybill: "303030",
    accountFormat: /^\d{10}$/,  // 10 digit account numbers
  },
  STANBIC_BANK: {
    name: "Stanbic Bank",
    paybill: "100100",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
  STANDARD_CHARTERED: {
    name: "Standard Chartered Bank",
    paybill: "329329",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
  DTB: {
    name: "Diamond Trust Bank",
    paybill: "525252",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
  I_AND_M_BANK: {
    name: "I&M Bank",
    paybill: "466000",
    accountFormat: /^\d{13}$/,  // 13 digit account numbers
  },
} as const;

export type BankPaybillKey = keyof typeof KENYA_BANK_PAYBILLS;

// Lookup bank by paybill number
export function getBankByPaybill(paybillNumber: string) {
  return Object.values(KENYA_BANK_PAYBILLS).find(
    (bank) => bank.paybill === paybillNumber
  );
}

// Validate bank account number format for specific bank
export function validateBankAccount(
  paybillNumber: string,
  accountNumber: string
): { valid: boolean; error?: string } {
  const bank = getBankByPaybill(paybillNumber);
  
  if (!bank) {
    return {
      valid: false,
      error: "Unknown bank paybill number",
    };
  }
  
  if (!bank.accountFormat.test(accountNumber)) {
    return {
      valid: false,
      error: `Invalid account number format for ${bank.name}. Expected ${bank.accountFormat.toString()}`,
    };
  }
  
  return { valid: true };
}

// Get all banks as options for dropdown
export function getBankOptions() {
  return Object.values(KENYA_BANK_PAYBILLS).map((bank) => ({
    label: `${bank.name} (${bank.paybill})`,
    value: bank.paybill,
    name: bank.name,
  }));
}
