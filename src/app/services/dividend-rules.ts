export const ChitType = {
  ALWAYS_COMMISSION: 1,
  STANDARD_NON_WINNERS_ONLY: 2
} as const;

export const CommissionTreatment = {
  DEDUCT_FROM_DISCOUNT: 1,
  ADD_TO_DISCOUNT: 2
} as const;

export function getDividendPool(discount: number, commission: number, treatment: number = CommissionTreatment.DEDUCT_FROM_DISCOUNT): number {
  const adjusted = treatment === CommissionTreatment.ADD_TO_DISCOUNT ? discount + commission : discount - commission;
  return Math.max(0, adjusted);
}

export function getEligibleMemberCount(type: number, totalMembers: number, termNumber: number): number {
  return type === ChitType.ALWAYS_COMMISSION
    ? Math.max(0, totalMembers)
    : Math.max(0, totalMembers - termNumber);
}

export function getRoundedDividendPerMember(pool: number, eligibleMembers: number): number {
  return eligibleMembers > 0 ? Math.round(pool / eligibleMembers) : 0;
}
