import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

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
    const validationError = this.getProfitRequestValidationError(request);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const frequencyInMonths = request.frequencyInMonths;
    const remainingTerms = request.totalMembers - request.currentTermNumber;
    const installmentAmount = request.chitValue / request.totalMembers;
    const baseFutureInvestment = installmentAmount * remainingTerms;
    const discountAmount = request.winningAmount;
    const agentCommissionAmount = request.agentCommissionAmount;
    let takeHomeAmount = request.chitValue - discountAmount - agentCommissionAmount;

    if (request.excludeOwnShare) {
      takeHomeAmount -= installmentAmount;
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
    const futureInvestment = request.enableReinvestment
      ? totalExtraPayment
      : baseFutureInvestment;
    const totalInvestment = request.pastInvestment + futureInvestment;
    const netProfit = takeHomeAmount - totalInvestment;
    const profitPercentage = totalInvestment > 0 ? netProfit / totalInvestment * 100 : 0;
    const remainingMonths = Math.max(1, remainingTerms * frequencyInMonths);
    const annualizedProfitPercentage = profitPercentage * 12 / remainingMonths;
    const profitInterestRupee = netProfit / remainingMonths;
    
    const ownShareAmount = request.excludeOwnShare ? installmentAmount : 0;
    const requiredTakeHomeAtBreakEven = this.getRequiredTakeHomeAtBreakEven(
      request.pastInvestment,
      installmentAmount,
      remainingTerms,
      request.enableReinvestment ? annualRate : 0,
      frequencyInMonths
    );
    const breakEvenDiscountAmount = request.chitValue
      - agentCommissionAmount
      - ownShareAmount
      - requiredTakeHomeAtBreakEven;
    
    const maxAllowedDiscountAmount = Math.max(
      0,
      request.chitValue - agentCommissionAmount - ownShareAmount - 1
    );
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
      netProfit: this.toCurrency(netProfit),
      profitPercentage: this.toPercent(profitPercentage),
      annualizedProfitPercentage: this.toPercent(annualizedProfitPercentage),
      profitInterestRupee: this.toCurrency(profitInterestRupee),
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
    const validationError = this.getReinvestmentRequestValidationError(request);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const annualRate = this.resolveAnnualInterestRate(request.interestPercent, request.interestRupee);
    const monthlyInterest = request.winningAmount * annualRate / 12 / 100;
    const totalInterest = monthlyInterest * request.remainingTerms;
    const remainingPayment = request.installmentAmount * request.remainingTerms;
    const outOfPocket = Math.max(0, remainingPayment - totalInterest);

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
      bestTimeToBid: currentDiscountPercent < averageExpectedDiscount ? 'NOW' : 'WAIT',
      expectedDiscountRange: '10% - 20%'
    });
  }

  private resolveAnnualInterestRate(interestPercent?: number, interestRupee?: number): number {
    if (interestPercent !== undefined) {
      return interestPercent;
    }

    if (interestRupee !== undefined) {
      return interestRupee * 12;
    }

    return 24;
  }

  private getProfitRequestValidationError(request: ProfitRequest): string | null {
    if (!this.isFiniteNumber(request.chitValue) || request.chitValue <= 0) {
      return 'Chit value must be greater than zero.';
    }

    if (!this.isFiniteNumber(request.winningAmount) || request.winningAmount < 0) {
      return 'Discount amount cannot be negative.';
    }

    if (!Number.isInteger(request.totalMembers) || request.totalMembers <= 0) {
      return 'Total members must be a positive whole number.';
    }

    if (
      !Number.isInteger(request.currentTermNumber) ||
      request.currentTermNumber < 1 ||
      request.currentTermNumber > request.totalMembers
    ) {
      return 'Current term must be a whole number within the chit term range.';
    }

    if (!Number.isInteger(request.frequencyInMonths) || request.frequencyInMonths <= 0) {
      return 'Frequency must be a positive whole number of months.';
    }

    if (!this.isFiniteNumber(request.pastInvestment) || request.pastInvestment < 0) {
      return 'Past investment cannot be negative.';
    }

    if (!this.isFiniteNumber(request.agentCommissionAmount) || request.agentCommissionAmount < 0) {
      return 'Commission amount cannot be negative.';
    }

    const installmentAmount = request.chitValue / request.totalMembers;
    const ownShareAmount = request.excludeOwnShare ? installmentAmount : 0;
    if (request.winningAmount + request.agentCommissionAmount + ownShareAmount >= request.chitValue) {
      return 'Discount, commission, and excluded own share must be less than the chit value.';
    }

    if (request.enableReinvestment) {
      return this.getInterestValidationError(request.interestPercent, request.interestRupee);
    }

    return null;
  }

  private getReinvestmentRequestValidationError(request: ReinvestmentRequest): string | null {
    if (!this.isFiniteNumber(request.winningAmount) || request.winningAmount < 0) {
      return 'Winning amount cannot be negative.';
    }

    if (!Number.isInteger(request.remainingTerms) || request.remainingTerms < 0) {
      return 'Remaining terms must be a non-negative whole number.';
    }

    if (!this.isFiniteNumber(request.installmentAmount) || request.installmentAmount < 0) {
      return 'Installment amount cannot be negative.';
    }

    return this.getInterestValidationError(request.interestPercent, request.interestRupee);
  }

  private getInterestValidationError(interestPercent?: number, interestRupee?: number): string | null {
    if (interestPercent === undefined && interestRupee === undefined) {
      return 'An interest rate is required when reinvestment is enabled.';
    }

    if (interestPercent !== undefined && (!this.isFiniteNumber(interestPercent) || interestPercent < 0)) {
      return 'Annual interest must be a non-negative number.';
    }

    if (interestRupee !== undefined && (!this.isFiniteNumber(interestRupee) || interestRupee < 0)) {
      return 'Monthly interest must be a non-negative number.';
    }

    return null;
  }

  private getRequiredTakeHomeAtBreakEven(
    pastInvestment: number,
    installmentAmount: number,
    remainingTerms: number,
    annualRate: number,
    frequencyInMonths: number
  ): number {
    if (remainingTerms === 0 || annualRate === 0) {
      return pastInvestment + installmentAmount * remainingTerms;
    }

    const interestFactorPerTerm = annualRate / 12 / 100 * frequencyInMonths;
    if (pastInvestment * interestFactorPerTerm >= installmentAmount) {
      return pastInvestment;
    }

    return (pastInvestment + installmentAmount * remainingTerms)
      / (1 + interestFactorPerTerm * remainingTerms);
  }

  private isFiniteNumber(value: number): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private toCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toPercent(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
