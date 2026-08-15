import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CalculationService, ProfitRequest, ProfitResponse } from '../services/calculation.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Chit, ChitService } from '../services/chit.service';

@Component({
  selector: 'app-auction',
  imports: [FormsModule, CommonModule],
  templateUrl: './auction.html',
  styleUrl: './auction.css',
})
export class AuctionComponent implements OnInit {
  savedChits: Chit[] = [];
  selectedChitId = '';
  selectedChit: Chit | null = null;

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

  // Re-investment
  reinvestEnabled: boolean = true;
  annualInterest: number | null = 24;
  monthlyRupee: number | null = 2;
  private sliderCalculationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private calcService: CalculationService,
    private cdr: ChangeDetectorRef,
    private chitService: ChitService
  ) { }

  ngOnInit(): void {
    this.loadSavedChits();
  }

  toggleModalResults(): void {
    this.showModalResults = !this.showModalResults;
  }

  calculateProfit(): void {
    this.queueProfitCalculation(false);
  }

  loadSavedChits(): void {
    this.chitService.getChits().subscribe(chits => {
      this.savedChits = chits;
      const persistedSelection = this.chitService.getSelectedChitId();
      if (persistedSelection) {
        this.applySavedChit(persistedSelection, false);
      } else if (this.savedChits.length === 1) {
        this.applySavedChit(this.savedChits[0].id, false);
      }
    });
  }

  applySavedChit(chitId: string, persistSelection = true): void {
    this.selectedChitId = chitId;
    if (persistSelection) {
      this.chitService.setSelectedChitId(chitId || null);
    }

    if (!chitId) {
      this.selectedChit = null;
      return;
    }

    this.chitService.getChit(chitId).subscribe(chit => {
      if (!chit) {
        this.selectedChit = null;
        return;
      }

      this.selectedChit = chit;
      this.totalAmount = chit.chitAmount;
      this.participants = chit.totalMembers;
      this.frequency = chit.frequencyInMonths;
      this.currentChitNumber = Math.max(1, chit.currentTermNumber || 1);
      this.pastInvestment = this.chitService.getPastInvestment(chit);
      this.agentCommissionAmount = chit.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM'
        ? (chit.agentCommissionAmount ?? 0)
        : 0;
      this.discountAmount = null;
      this.excludeOwnShare = true;
      this.reinvestEnabled = true;
      this.hasAttemptedSubmit = false;
      this.profit = null;
      this.bidNowResult = null;
      this.waitResult = null;
      this.showModalResults = false;
    });
  }

  clearSavedChit(): void {
    this.selectedChitId = '';
    this.selectedChit = null;
    this.chitService.setSelectedChitId(null);
  }

  validateAndCalculate(): void {
    this.hasAttemptedSubmit = true;
    if (this.isFormValid()) {
      this.calculateProfit();
      this.showModalResults = true;
    } else {
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
      this.totalAmount !== null &&
      this.totalAmount > 0 &&
      this.participants !== null &&
      this.participants > 0 &&
      this.discountAmount !== null &&
      this.discountAmount >= 0 &&
      this.currentChitNumber !== null &&
      this.currentChitNumber >= 1 &&
      this.currentChitNumber <= this.participants &&
      this.pastInvestment !== null &&
      this.agentCommissionAmount !== null &&
      this.agentCommissionAmount >= 0
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    if (!this.hasAttemptedSubmit) return false;
    switch (fieldName) {
      case 'totalAmount': return this.totalAmount === null || this.totalAmount <= 0;
      case 'participants': return this.participants === null || this.participants <= 0;
      case 'discountAmount': return this.discountAmount === null || this.discountAmount < 0;
      case 'currentChitNumber': return this.currentChitNumber === null || this.currentChitNumber < 1 || (this.participants !== null && this.currentChitNumber > this.participants);
      case 'pastInvestment': return this.pastInvestment === null;
      case 'agentCommissionAmount': return this.agentCommissionAmount === null || this.agentCommissionAmount < 0;
      default: return false;
    }
  }

  onDiscountSliderChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.discountAmount = value;

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

  getInstallmentAmount(): number {
    return this.getShareAmount();
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

    const remainingMonths = Math.max(1, this.profit.remainingTerms * this.profit.frequencyInMonths);
    return this.profit.netProfit / remainingMonths;
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
      this.profit = null;
      this.bidNowResult = null;
      this.isCalculating = false;
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



  private buildProfitRequest(): ProfitRequest | null {
    if (
      this.totalAmount === null ||
      this.participants === null ||
      this.discountAmount === null ||
      this.currentChitNumber === null
    ) {
      return null;
    }

    if (
      this.totalAmount <= 0 ||
      this.participants <= 0 ||
      this.discountAmount < 0 ||
      this.currentChitNumber < 1 ||
      this.currentChitNumber > this.participants
    ) {
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
      frequencyInMonths: this.frequency,
      agentCommissionAmount: this.agentCommissionAmount || 0,
      enableReinvestment: this.reinvestEnabled,
      excludeOwnShare: this.excludeOwnShare,
      interestPercent: this.annualInterest ?? undefined,
      interestRupee: this.monthlyRupee ?? undefined
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
    // Placeholder - calculate benefit of waiting
    const potentialFutureDiscount = (this.totalAmount || 0) * 0.15; // Assume 15% future discount
    this.waitResult = `Potential additional profit: Rs.${potentialFutureDiscount.toLocaleString()}`;
  }
}
