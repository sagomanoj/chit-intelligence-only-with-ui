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
  totalAmount: number = 0;
  participants: number = 0;
  frequency: number = 1;
  agentCommissionAmount: number = 0;
  currentChitNumber: number = 1;
  pastInvestment: number = 0;
  discountAmount: number = 0;

  // Results
  profit: ProfitResponse | null = null;
  bidNowResult: ProfitResponse | null = null;
  waitResult: string | null = null;
  isCalculating: boolean = false;

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

  calculateProfit(): void {
    this.syncInputsFromView();
    this.queueProfitCalculation(false);
  }

  onDiscountSliderChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.discountAmount = value;

    if (this.profit) {
      this.queueProfitCalculation(true);
    }
  }

  getDiscountUpperBound(): number {
    const totalAmount = this.readNumberInput('totalAmount', this.totalAmount);
    const commissionAmount = this.readNumberInput('agentCommissionAmount', this.agentCommissionAmount);
    return Math.max(0, Math.floor(totalAmount - commissionAmount - 1));
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
      this.sliderCalculationTimer = setTimeout(() => this.runProfitCalculation(), 250);
      return;
    }

    this.runProfitCalculation();
  }

  private runProfitCalculation(): void {
    const request = this.buildProfitRequest();
    if (!request) {
      return;
    }

    this.isCalculating = true;
    this.profit = null;
    this.bidNowResult = null;

    this.calcService.calculateProfit(request).subscribe({
      next: res => {
        this.profit = res;
        this.bidNowResult = res;
        this.isCalculating = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isCalculating = false;
        alert('Unable to calculate profit/loss. Please check whether the backend is running.');
        this.cdr.detectChanges();
      }
    });
  }

  private syncInputsFromView(): void {
    this.totalAmount = this.readNumberInput('totalAmount', this.totalAmount);
    this.participants = this.readNumberInput('participants', this.participants);
    this.frequency = this.readNumberInput('frequency', this.frequency);
    this.agentCommissionAmount = this.readNumberInput('agentCommissionAmount', this.agentCommissionAmount);
    this.currentChitNumber = this.readNumberInput('currentChitNumber', this.currentChitNumber);
    this.pastInvestment = this.readNumberInput('pastInvestment', this.pastInvestment);
    this.discountAmount = this.readNumberInput('discountAmount', this.discountAmount);
    this.annualInterest = this.readNullableNumberInput('annualInterest', this.annualInterest);
    this.monthlyRupee = this.readNullableNumberInput('monthlyRupee', this.monthlyRupee);
  }

  private readNumberInput(id: string, fallback: number): number {
    const value = this.readInputValue(id);
    if (value === '') {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readNullableNumberInput(id: string, fallback: number | null): number | null {
    const value = this.readInputValue(id);
    if (value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readInputValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    return element?.value?.trim() ?? '';
  }

  private buildProfitRequest(): ProfitRequest | null {
    if (this.totalAmount <= 0 || this.participants <= 0 || this.discountAmount <= 0) {
      return null;
    }

    const commissionAmount = this.agentCommissionAmount;
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
      pastInvestment: this.pastInvestment,
      frequencyInMonths: this.frequency,
      agentCommissionAmount: this.agentCommissionAmount,
      enableReinvestment: this.reinvestEnabled,
      interestPercent: this.annualInterest || undefined,
      interestRupee: this.monthlyRupee || undefined
    };
  }

  onInterestChange(type: 'percent' | 'rupee', event: Event): void {
    const inputValue = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(inputValue)) {
      return;
    }

    if (type === 'percent') {
      this.annualInterest = inputValue;
      this.monthlyRupee = inputValue / 12;
    } else {
      this.monthlyRupee = inputValue;
      this.annualInterest = inputValue * 12;
    }
  }

  calculateBidNow(): void {
    this.calculateProfit();
  }

  calculateWait(): void {
    // Placeholder - calculate benefit of waiting
    const potentialFutureDiscount = this.totalAmount * 0.15; // Assume 15% future discount
    this.waitResult = `Potential additional profit: Rs.${potentialFutureDiscount.toLocaleString()}`;
  }
}
