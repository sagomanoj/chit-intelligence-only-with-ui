import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Chit, ChitTerm } from './local-storage.service';
import { ChitType, CommissionTreatment, getDividendPool, getEligibleMemberCount, getRoundedDividendPerMember } from './dividend-rules';

export interface ProfitRequest {
  chitValue: number;
  winningAmount: number;
  currentTermNumber: number;
  totalMembers: number;
  dividendDistributionType: number;
  commissionTreatmentType?: number;
  currentMemberDividend?: number;
  previouslyWon?: boolean;
  pastDividend: number;
  pastInvestment: number;
  frequencyInMonths: number;
  agentCommissionAmount: number;
  enableReinvestment: boolean;
  excludeOwnShare: boolean;
  interestPercent?: number;
  interestRupee?: number;
}

export interface ProfitResponse {
  netProfit: number;
  profitPercentage: number;
  annualizedProfitPercentage?: number;
  profitInterestRupee?: number;
  status: string;
  takeHomeAmount: number;
  auctionAmount: number;
  discountAmount: number;
  agentCommissionAmount: number;
  breakEvenDiscountAmount: number | null;
  maxAllowedDiscountAmount: number;
  pastInvestment: number;
  futureInvestment: number;
  totalInvestment: number;
  installmentAmount: number;
  remainingTerms: number;
  frequencyInMonths: number;
  reinvestmentEnabled: boolean;
  annualInterestPercent: number;
  interestRupee: number;
  monthlyInterest: number;
  interestPerTerm: number;
  totalReinvestmentInterest: number;
  extraPaymentPerTerm: number;
  totalExtraPayment: number;
  coverageStatus: string;
}

export interface ReinvestmentRequest {
  winningAmount: number;
  interestPercent?: number;
  interestRupee?: number;
  remainingTerms: number;
  installmentAmount: number;
}

export interface ReinvestmentResponse {
  monthlyInterest: number;
  totalInterest: number;
  outOfPocket: number;
  coverageStatus: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalculationService {
  private returnRates(net: number, paid: number, months: number) {
    const overall = paid > 0 ? net / paid * 100 : 0;
    const annual = overall * 12 / Math.max(1, months);
    return {
      profitPercentage: this.toPercent(overall),
      annualizedProfitPercentage: this.toPercent(annual),
      profitInterestRupee: this.toPercent(annual / 12)
    };
  }

  winningAuctionReturn(chit: Chit, terms: ChitTerm[]) {
    const win = terms.find(term => term.isSelfPrized);
    if (!win) return null;

    const installment = chit.installmentAmount;
    const excludeShare = chit.excludeCurrentTermShare !== false;
    const payout = win.payoutReceived ?? Math.max(0, chit.chitValue - win.winningBidAmount
      - (win.agentCommission ?? chit.agentCommissionAmount) - (excludeShare ? installment : 0));
    // Winning records store zero paid. When the full payout is kept, count that payment separately.
    const winningPayment = excludeShare ? 0 : Math.max(0, installment - (win.dividendPerMember ?? 0));
    const recordedPayments = terms.reduce((sum, term) => sum + (term === win ? winningPayment : term.netInstallmentPaid), 0);
    const unrecorded = Math.max(0, chit.totalMembers - terms.length);
    const totalPayments = recordedPayments + unrecorded * installment;
    const net = this.toCurrency(payout - totalPayments);
    const months = (chit.totalMembers - win.termNumber || chit.totalMembers) * (chit.frequencyInMonths || 1);
    return {
      net, amount: Math.abs(net), estimated: unrecorded > 0, hasRate: totalPayments > 0,
      ...this.returnRates(net, totalPayments, months)
    };
  }

  // Find the highest whole-rupee discount that still covers payments. The member's
  // rounded discount share can itself change as the bid changes.
  private highestDiscountWithoutLoss(request: ProfitRequest, installment: number, remaining: number, max: number): number | null {
    const eligible = request.dividendDistributionType === ChitType.ALWAYS_COMMISSION || !request.previouslyWon;
    const members = getEligibleMemberCount(request.dividendDistributionType, request.totalMembers, request.currentTermNumber);
    const coversPayments = (bid: number) => {
      const share = eligible ? getRoundedDividendPerMember(getDividendPool(bid, request.agentCommissionAmount, request.commissionTreatmentType), members) : 0;
      const payout = Math.max(0, request.chitValue - request.agentCommissionAmount - bid - (request.excludeOwnShare ? installment : 0));
      const paid = request.pastInvestment + remaining * installment + (request.excludeOwnShare ? 0 : Math.max(0, installment - share));
      return this.toCurrency(payout - paid) >= 0;
    };
    if (!coversPayments(0)) return null;
    let low = 0;
    let high = Math.floor(max);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (coversPayments(mid)) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  calculateProfit(request: ProfitRequest): Observable<ProfitResponse> {
    const frequencyInMonths = Math.max(1, request.frequencyInMonths || 1);
    const remainingTerms = Math.max(0, request.totalMembers - request.currentTermNumber);
    const installmentAmount = request.totalMembers > 0 ? request.chitValue / request.totalMembers : 0;
    const discountAmount = request.winningAmount || 0;
    const agentCommissionAmount = request.agentCommissionAmount || 0;

    let takeHomeAmount = request.chitValue - discountAmount - agentCommissionAmount;
    let futureInvestment = installmentAmount * remainingTerms;
    let totalInvestment: number;

    if (request.excludeOwnShare && request.totalMembers > 0) {
      takeHomeAmount = Math.max(0, takeHomeAmount - installmentAmount);
      totalInvestment = request.pastInvestment + futureInvestment;
    } else {
      totalInvestment = request.pastInvestment + Math.max(0, installmentAmount - (request.currentMemberDividend || 0)) + futureInvestment;
    }

    const annualRate = this.resolveAnnualInterestRate(request.interestPercent, request.interestRupee);
    const interestRupee = annualRate / 12;
    const monthlyInterest = request.enableReinvestment ? (takeHomeAmount * annualRate) / 12 / 100 : 0;
    const interestPerTerm = monthlyInterest * frequencyInMonths;
    const totalReinvestmentInterest = interestPerTerm * remainingTerms;
    const extraPaymentPerTerm = request.enableReinvestment
      ? Math.max(0, installmentAmount - interestPerTerm)
      : installmentAmount;
    const totalExtraPayment = extraPaymentPerTerm * remainingTerms;
    const netProfit = takeHomeAmount - totalInvestment;
    const months = (remainingTerms || request.totalMembers) * frequencyInMonths;
    const maxAllowedDiscountAmount = Math.max(0, request.chitValue - agentCommissionAmount - 1);

    const coverageStatus = !request.enableReinvestment
      ? 'NOT_APPLICABLE'
      : interestPerTerm >= installmentAmount
        ? 'FULLY_COVERED'
        : 'PARTIAL';

    let status = 'PROFIT';
    if (Math.abs(netProfit) < 0.01) {
      status = 'NO PROFIT / NO LOSS';
    } else if (netProfit < 0) {
      status = 'LOSS';
    }

    return of({
      netProfit: this.toCurrency(Math.abs(netProfit)),
      ...this.returnRates(netProfit, totalInvestment, months),
      status: status,
      takeHomeAmount: this.toCurrency(takeHomeAmount),
      auctionAmount: this.toCurrency(discountAmount),
      discountAmount: this.toCurrency(discountAmount),
      agentCommissionAmount: this.toCurrency(agentCommissionAmount),
      breakEvenDiscountAmount: this.highestDiscountWithoutLoss(request, installmentAmount, remainingTerms, maxAllowedDiscountAmount),
      maxAllowedDiscountAmount: this.toCurrency(maxAllowedDiscountAmount),
      pastInvestment: this.toCurrency(request.pastInvestment),
      futureInvestment: this.toCurrency(futureInvestment),
      totalInvestment: this.toCurrency(totalInvestment),
      installmentAmount: this.toCurrency(installmentAmount),
      remainingTerms,
      frequencyInMonths,
      reinvestmentEnabled: request.enableReinvestment,
      annualInterestPercent: annualRate,
      interestRupee,
      monthlyInterest: this.toCurrency(monthlyInterest),
      interestPerTerm: this.toCurrency(interestPerTerm),
      totalReinvestmentInterest: this.toCurrency(totalReinvestmentInterest),
      extraPaymentPerTerm: this.toCurrency(extraPaymentPerTerm),
      totalExtraPayment: this.toCurrency(totalExtraPayment),
      coverageStatus
    });
  }

  buildProfitRequestFromChit(
    chit: Chit,
    terms: ChitTerm[],
    targetTermNumber?: number,
    winningAmount?: number
  ): ProfitRequest {
    const sortedTerms = [...terms].sort((a, b) => a.termNumber - b.termNumber);
    const nextTerm = targetTermNumber || (sortedTerms.length + 1);
    
    // Past terms are those prior to target term
    const priorTerms = sortedTerms.filter(t => t.termNumber < nextTerm);
    const pastInvestment = priorTerms.reduce((sum, t) => sum + t.netInstallmentPaid, 0);
    const pastDividend = priorTerms.reduce((sum, t) => sum + t.dividendPerMember, 0);

    const defaultWinning = winningAmount ?? (chit.chitValue * 0.15); // default 15% discount for calculation

    const distributionType = chit.dividendDistributionType ?? ChitType.STANDARD_NON_WINNERS_ONLY;
    const commissionTreatmentType = chit.commissionTreatmentType ?? CommissionTreatment.DEDUCT_FROM_DISCOUNT;
    const userPreviouslyWon = priorTerms.some(t => t.isSelfPrized);
    const eligibleMembers = getEligibleMemberCount(distributionType, chit.totalMembers, Math.min(nextTerm, chit.totalMembers));
    const memberDividend = distributionType === ChitType.ALWAYS_COMMISSION || !userPreviouslyWon
      ? getRoundedDividendPerMember(getDividendPool(defaultWinning, chit.agentCommissionAmount || 0, commissionTreatmentType), eligibleMembers)
      : 0;

    return {
      chitValue: chit.chitValue,
      winningAmount: defaultWinning,
      currentTermNumber: Math.min(nextTerm, chit.totalMembers),
      totalMembers: chit.totalMembers,
      dividendDistributionType: distributionType,
      commissionTreatmentType,
      currentMemberDividend: memberDividend,
      previouslyWon: userPreviouslyWon,
      pastDividend,
      pastInvestment,
      frequencyInMonths: chit.frequencyInMonths || 1,
      agentCommissionAmount: (chit.agentCommissionAmount !== undefined && chit.agentCommissionAmount !== null)
        ? Number(chit.agentCommissionAmount)
        : (chit.agentCommissionPercent !== undefined && chit.agentCommissionPercent !== null)
          ? Number((chit.chitValue * chit.agentCommissionPercent) / 100)
          : Number(chit.chitValue * 0.05),
      enableReinvestment: chit.reinvestmentDefaults?.enableReinvestment ?? true,
      excludeOwnShare: chit.excludeCurrentTermShare !== undefined ? chit.excludeCurrentTermShare : true,
      interestPercent: chit.reinvestmentDefaults?.annualInterest ?? 24,
      interestRupee: chit.reinvestmentDefaults?.monthlyRupee ?? 2
    };
  }

  calculateReinvestment(request: ReinvestmentRequest): Observable<ReinvestmentResponse> {
    const annualRate = this.resolveAnnualInterestRate(request.interestPercent, request.interestRupee);
    const monthlyInterest = (request.winningAmount * annualRate) / 12 / 100;
    const totalInterest = monthlyInterest * request.remainingTerms;
    const remainingPayment = request.installmentAmount * request.remainingTerms;
    const outOfPocket = remainingPayment - totalInterest;

    return of({
      monthlyInterest: this.toCurrency(monthlyInterest),
      totalInterest: this.toCurrency(totalInterest),
      outOfPocket: this.toCurrency(outOfPocket),
      coverageStatus: monthlyInterest >= request.installmentAmount ? 'FULLY_COVERED' : 'PARTIAL'
    });
  }

  getRecommendation(currentProfit: number, futureProfit: number): Observable<{ recommendation: string }> {
    return of({ recommendation: currentProfit > futureProfit ? 'BID NOW' : 'WAIT' });
  }

  private resolveAnnualInterestRate(interestPercent?: number, interestRupee?: number): number {
    if (interestPercent !== undefined && interestPercent !== null && !isNaN(interestPercent)) {
      return interestPercent;
    }

    if (interestRupee !== undefined && interestRupee !== null && !isNaN(interestRupee)) {
      return interestRupee * 12;
    }

    return 24;
  }

  private toCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toPercent(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
