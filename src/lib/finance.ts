export function calculateBalance(income: number, expenditure: number): number {
  return Number((income - expenditure).toFixed(2));
}

export function generateTransactionId(type: 'income' | 'expense', year: number, sequence: number): string {
  const prefix = type === 'income' ? 'INC' : 'EXP';
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

export function getPeriodSummary(income: number, expenditure: number, transactionCount = 2): {
  income: number;
  expenditure: number;
  balance: number;
  transactionCount: number;
} {
  return {
    income,
    expenditure,
    balance: calculateBalance(income, expenditure),
    transactionCount,
  };
}

export function formatCurrency(value: number, currency = '₦'): string {
  return `${currency}${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthLabel(monthIndex: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex] ?? 'Unknown';
}
