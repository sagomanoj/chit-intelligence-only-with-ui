import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

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
    const frequencyInMonths = Math.max(1, request.frequencyInMonths);
    const remainingTerms = Math.max(0, request.totalMembers - request.currentTermNumber);
    const installmentAmount = request.totalMembers > 0 ? request.chitValue / request.totalMembers : 0;
    const baseFutureInvestment = installmentAmount * remainingTerms;
    let futureInvestment = baseFutureInvestment;
    const discountAmount = request.winningAmount;
    const agentCommissionAmount = request.agentCommissionAmount;
    let takeHomeAmount = request.chitValue - discountAmount - agentCommissionAmount;

    if (request.excludeOwnShare && request.totalMembers > 0) {
      takeHomeAmount -= installmentAmount;
      futureInvestment = Math.max(0, futureInvestment - installmentAmount);
    }

    const annualRate = this.resolveAnnualInterestRate(request.interestPercent, request.interestRupee);
    const interestRupee = annualRate / 12;
    const monthlyInterest = request.enableReinvestment ? takeHomeAmount * annualRate / 12 / 100 : 0;
    const interestPerTerm = monthlyInterest * frequencyInMonths;
    const totalReinvestmentInterest = interestPerTerm * remainingTerms;
    const extraPaymentPerTerm = request.enableReinvestment
      ? Math.max(0, installmentAmount - interestPerTerm)
      : installmentAmount;
    const totalExtraPayment = extraPaymentPerTerm * remainingTerms;
    const totalInvestment = request.pastInvestment + futureInvestment;
    const netProfit = takeHomeAmount - totalInvestment;
    const profitPercentage = totalInvestment > 0 ? netProfit / totalInvestment * 100 : 0;
    const remainingMonths = Math.max(1, remainingTerms * frequencyInMonths);
    const annualizedProfitPercentage = profitPercentage * 12 / remainingMonths;
    const profitInterestRupee = annualizedProfitPercentage / 12;
    
    const originalTotalInvestment = request.pastInvestment + baseFutureInvestment;
    const breakEvenDiscountAmount = request.chitValue - agentCommissionAmount - originalTotalInvestment;
    
    const maxAllowedDiscountAmount = Math.max(0, request.chitValue - agentCommissionAmount - 1);
    const coverageStatus = !request.enableReinvestment
      ? 'NOT_APPLICABLE'
      : interestPerTerm >= installmentAmount ? 'FULLY_COVERED' : 'PARTIAL';

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
      auctionAmount: this.toCurrency(request.winningAmount),
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

  calculateReinvestment(request: ReinvestmentRequest): Observable<ReinvestmentResponse> {
    const annualRate = this.resolveAnnualInterestRate(request.interestPercent, request.interestRupee);
    const monthlyInterest = request.winningAmount * annualRate / 12 / 100;
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

  getDetailedRecommendation(chitValue: number, currentAuctionAmount: number, currentTerm: number, totalMembers: number): Observable<{ bestTimeToBid: string; expectedDiscountRange: string }> {
    const currentDiscountPercent = chitValue > 0 ? currentAuctionAmount / chitValue * 100 : 0;
    const averageExpectedDiscount = 15;

    return of({
      bestTimeToBid: currentDiscountPercent > averageExpectedDiscount ? 'NOW' : 'WAIT',
      expectedDiscountRange: '10% - 20%'
    });
  }

  private resolveAnnualInterestRate(interestPercent?: number, interestRupee?: number): number {
    if (interestRupee !== undefined) {
      return interestRupee * 12;
    }

    if (interestPercent !== undefined) {
      return interestPercent;
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
