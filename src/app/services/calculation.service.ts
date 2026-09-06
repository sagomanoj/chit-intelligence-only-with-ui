import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Chit, ChitTerm } from './local-storage.service';

export interface ProfitRequest {
  chitValue: number;
  winningAmount: number;
  currentTermNumber: number;
  totalMembers: number;
  dividendDistributionType: number;
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
  breakEvenDiscountAmount: number;
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
      totalInvestment = request.pastInvestment + installmentAmount + futureInvestment;
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
    const profitPercentage = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    const remainingMonths = Math.max(1, remainingTerms * frequencyInMonths);
    const totalMonths = Math.max(1, request.totalMembers * frequencyInMonths);
    const annualizedProfitPercentage = remainingTerms > 0
      ? (profitPercentage * 12) / remainingMonths
      : (profitPercentage * 12) / totalMonths;
    const profitInterestRupee = annualizedProfitPercentage / 12;

    const totalExpectedInvestment = request.pastInvestment + (remainingTerms + 1) * installmentAmount;
    const breakEvenDiscountAmount = request.chitValue - agentCommissionAmount - totalExpectedInvestment;
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
      profitPercentage: this.toPercent(profitPercentage),
      annualizedProfitPercentage: this.toPercent(annualizedProfitPercentage),
      profitInterestRupee: this.toPercent(profitInterestRupee),
      status: status,
      takeHomeAmount: this.toCurrency(takeHomeAmount),
      auctionAmount: this.toCurrency(discountAmount),
      discountAmount: this.toCurrency(discountAmount),
      agentCommissionAmount: this.toCurrency(agentCommissionAmount),
      breakEvenDiscountAmount: this.toCurrency(Math.max(0, breakEvenDiscountAmount)),
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

    return {
      chitValue: chit.chitValue,
      winningAmount: defaultWinning,
      currentTermNumber: Math.min(nextTerm, chit.totalMembers),
      totalMembers: chit.totalMembers,
      dividendDistributionType: chit.dividendDistributionType || 1,
      pastDividend,
      pastInvestment,
      frequencyInMonths: chit.frequencyInMonths || 1,
      agentCommissionAmount: chit.agentCommissionAmount || (chit.chitValue * (chit.agentCommissionPercent || 5) / 100),
      enableReinvestment: chit.reinvestmentDefaults?.enableReinvestment ?? true,
      excludeOwnShare: true,
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
