import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CalculationService, ProfitRequest, ProfitResponse } from '../services/calculation.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auction',
  imports: [FormsModule, CommonModule],
  templateUrl: './auction.html',
  styleUrl: './auction.css',
})
export class AuctionComponent implements OnInit {
  // Input fields
  totalAmount: number | null = null;
  participants: number | null = null;
  frequency: number = 1;
  agentCommissionAmount: number | null = 0;
  currentChitNumber: number | null = null;
  pastInvestment: number | null = null;
  discountAmount: number | null = null;
  excludeOwnShare: boolean = true;

  // Results
  profit: ProfitResponse | null = null;
  bidNowResult: ProfitResponse | null = null;
  waitResult: string | null = null;
  isCalculating: boolean = false;
  showModalResults: boolean = false;
  hasAttemptedSubmit: boolean = false;
  errorMessage: string | null = null;

  // Re-investment
  reinvestEnabled: boolean = true;
  annualInterest: number | null = 24;
  monthlyRupee: number | null = 2;
  private sliderCalculationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private calcService: CalculationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
  }

  toggleModalResults(): void {
    this.showModalResults = !this.showModalResults;
  }

  calculateProfit(): void {
    this.queueProfitCalculation(false);
  }

  validateAndCalculate(): void {
    this.hasAttemptedSubmit = true;
    this.errorMessage = null;

    if (this.isFormValid()) {
      const commission = this.agentCommissionAmount || 0;
      const discount = this.discountAmount || 0;
      const total = this.totalAmount || 0;

      if (discount + commission >= total) {
        this.errorMessage = 'Bid Discount plus Commission Amount must be less than Total Chit Amount.';
        return;
      }

      this.calculateProfit();
      this.showModalResults = true;
    } else {
      this.cdr.detectChanges();
      setTimeout(() => {
        const firstError = document.querySelector('.error');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 0);
    }
  }

  isFormValid(): boolean {
    return !!(
      this.totalAmount &&
      this.participants &&
      this.discountAmount !== null &&
      this.discountAmount > 0 &&
      this.currentChitNumber &&
      this.pastInvestment !== null &&
      this.agentCommissionAmount !== null &&
      this.frequency
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    if (!this.hasAttemptedSubmit) return false;
    switch (fieldName) {
      case 'totalAmount': return !this.totalAmount || this.totalAmount <= 0;
      case 'participants': return !this.participants || this.participants <= 0;
      case 'discountAmount': return this.discountAmount === null || this.discountAmount <= 0;
      case 'currentChitNumber': return !this.currentChitNumber || this.currentChitNumber <= 0;
      case 'pastInvestment': return this.pastInvestment === null || this.pastInvestment < 0;
      case 'agentCommissionAmount': return this.agentCommissionAmount === null || this.agentCommissionAmount < 0;
      case 'frequency': return !this.frequency || this.frequency <= 0;
      default: return false;
    }
  }

  onDiscountSliderChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.discountAmount = value;
    this.errorMessage = null;

    if (this.isFormValid()) {
      this.queueProfitCalculation(true);
    }
  }

  onInputChange(): void {
    const maxDiscount = this.getDiscountUpperBound();
    if (this.discountAmount !== null && this.discountAmount > maxDiscount) {
      this.discountAmount = maxDiscount;
    }
    this.errorMessage = null;

    if (this.profit && this.isFormValid()) {
      this.queueProfitCalculation(true);
    }
  }

  getDiscountUpperBound(): number {
    const totalAmount = this.totalAmount || 0;
    const commissionAmount = this.agentCommissionAmount || 0;
    return Math.max(0, Math.floor(totalAmount - commissionAmount - 1));
  }

  getShareAmount(): number {
    return (this.participants && this.participants > 0) ? (this.totalAmount || 0) / this.participants : 0;
  }

  getAnnualizedProfitPercentage(): number {
    if (!this.profit) {
      return 0;
    }

    if (Number.isFinite(this.profit.annualizedProfitPercentage)) {
      return this.profit.annualizedProfitPercentage ?? 0;
    }

    const remainingMonths = Math.max(1, this.profit.remainingTerms * this.profit.frequencyInMonths);
    const overallProfitPercentage = this.profit.totalInvestment > 0
      ? this.profit.netProfit / this.profit.totalInvestment * 100
      : 0;

    return overallProfitPercentage * 12 / remainingMonths;
  }

  getProfitInterestRupee(): number {
    if (!this.profit) {
      return 0;
    }

    if (Number.isFinite(this.profit.profitInterestRupee)) {
      return this.profit.profitInterestRupee ?? 0;
    }

    return this.getAnnualizedProfitPercentage() / 12;
  }

  private queueProfitCalculation(debounce: boolean): void {
    if (this.sliderCalculationTimer) {
      clearTimeout(this.sliderCalculationTimer);
      this.sliderCalculationTimer = null;
    }

    if (debounce) {
      this.sliderCalculationTimer = setTimeout(() => this.runProfitCalculation(), 80);
      return;
    }

    this.runProfitCalculation();
  }

  private runProfitCalculation(): void {
    const request = this.buildProfitRequest();
    if (!request) {
      this.profit = null;
      this.bidNowResult = null;
      this.isCalculating = false;
      return;
    }

    this.isCalculating = true;

    this.calcService.calculateProfit(request).subscribe({
      next: res => {
        this.profit = res;
        this.bidNowResult = res;
        this.isCalculating = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isCalculating = false;
        alert('Unable to calculate profit/loss. Please check calculation parameters.');
        this.cdr.detectChanges();
      }
    });
  }

  private buildProfitRequest(): ProfitRequest | null {
    if (!this.totalAmount || !this.participants || this.discountAmount === null || !this.currentChitNumber) {
      return null;
    }

    if (this.totalAmount <= 0 || this.participants <= 0 || this.discountAmount <= 0) {
      return null;
    }

    const commissionAmount = this.agentCommissionAmount || 0;
    if (this.discountAmount + commissionAmount >= this.totalAmount) {
      return null;
    }

    return {
      chitValue: this.totalAmount,
      winningAmount: this.discountAmount,
      currentTermNumber: this.currentChitNumber,
      totalMembers: this.participants,
      dividendDistributionType: 1,
      pastDividend: 0,
      pastInvestment: this.pastInvestment || 0,
      frequencyInMonths: this.frequency || 1,
      agentCommissionAmount: commissionAmount,
      enableReinvestment: this.reinvestEnabled,
      excludeOwnShare: this.excludeOwnShare,
      interestPercent: (this.annualInterest !== null && this.annualInterest !== undefined && !isNaN(this.annualInterest))
        ? this.annualInterest
        : undefined,
      interestRupee: (this.monthlyRupee !== null && this.monthlyRupee !== undefined && !isNaN(this.monthlyRupee))
        ? this.monthlyRupee
        : undefined
    };
  }

  onInterestModelChange(type: 'percent' | 'rupee', newValue: any): void {
    const parsed = (newValue === null || newValue === '') ? null : Number(newValue);

    if (type === 'percent') {
      this.annualInterest = parsed;
      if (parsed !== null && Number.isFinite(parsed)) {
        this.monthlyRupee = Number((parsed / 12).toFixed(2));
      } else {
        this.monthlyRupee = null;
      }
    } else {
      this.monthlyRupee = parsed;
      if (parsed !== null && Number.isFinite(parsed)) {
        this.annualInterest = Number((parsed * 12).toFixed(2));
      } else {
        this.annualInterest = null;
      }
    }

    if (this.profit && this.isFormValid()) {
      this.calculateProfit();
    }
  }

  calculateBidNow(): void {
    this.calculateProfit();
  }

  calculateWait(): void {
    const potentialFutureDiscount = (this.totalAmount || 0) * 0.15;
    this.waitResult = `Potential additional profit: Rs.${potentialFutureDiscount.toLocaleString()}`;
  }
}

