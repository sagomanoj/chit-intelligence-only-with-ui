import { SheetDirective } from '../sheet.directive';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CalculationService, ProfitRequest, ProfitResponse } from '../services/calculation.service';
import { ChitService, Chit, ChitTerm } from '../services/chit.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChitType, CommissionTreatment, getDividendPool, getEligibleMemberCount, getRoundedDividendPerMember } from '../services/dividend-rules';
import { AppAdsService } from '../services/app-ads.service';

@Component({
  selector: 'app-auction',
  imports: [SheetDirective, FormsModule, CommonModule],
  templateUrl: './auction.html',
  styleUrl: './auction.css',
})
export class AuctionComponent implements OnInit {
  readonly ChitType = ChitType;
  readonly CommissionTreatment = CommissionTreatment;
  // Active Chit Context (if navigated from chit)
  chitId: string | null = null;
  chit: Chit | null = null;
  terms: ChitTerm[] = [];

  // Input fields
  totalAmount: number | null = null;
  participants: number | null = null;
  frequency: number = 1;
  agentCommissionAmount: number | null = 0;
  currentChitNumber: number | null = null;
  pastInvestment: number | null = null;
  discountAmount: number | null = null;
  excludeOwnShare: boolean = true;
  dividendDistributionType: number = ChitType.STANDARD_NON_WINNERS_ONLY;
  commissionTreatmentType: number = CommissionTreatment.DEDUCT_FROM_DISCOUNT;
  hasPreviouslyWon: boolean = false;

  // Results
  profit: ProfitResponse | null = null;
  bidNowResult: ProfitResponse | null = null;
  waitResult: string | null = null;
  isCalculating: boolean = false;
  showModalResults: boolean = false;
  hasAttemptedSubmit: boolean = false;
  errorMessage: string | null = null;
  saveSuccessMessage: string | null = null;

  // Re-investment
  reinvestEnabled: boolean = true;
  annualInterest: number | null = 24;
  monthlyRupee: number | null = 2;
  private sliderCalculationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private calcService: CalculationService,
    private chitService: ChitService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private appAds: AppAdsService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        void this.appAds.prepareInterstitial();
        this.chitId = id;
        this.loadChitContext(id);
      }
    });
  }

  loadChitContext(id: string): void {
    this.chitService.getChit(id).subscribe(chit => {
      if (chit) {
        this.chit = chit;
        this.chitService.getTerms(id).subscribe(terms => {
          this.terms = terms;
          this.dividendDistributionType = chit.dividendDistributionType ?? ChitType.STANDARD_NON_WINNERS_ONLY;
          this.commissionTreatmentType = chit.commissionTreatmentType ?? CommissionTreatment.DEDUCT_FROM_DISCOUNT;
          this.hasPreviouslyWon = terms.some(term => term.isSelfPrized);
          const request = this.calcService.buildProfitRequestFromChit(chit, this.terms);

          this.totalAmount = request.chitValue;
          this.participants = request.totalMembers;
          this.frequency = request.frequencyInMonths;
          this.agentCommissionAmount = request.agentCommissionAmount;
          this.currentChitNumber = request.currentTermNumber;
          this.pastInvestment = request.pastInvestment;
          this.discountAmount = request.winningAmount;
          this.reinvestEnabled = request.enableReinvestment;
          this.excludeOwnShare = request.excludeOwnShare;
          this.annualInterest = request.interestPercent ?? 24;
          this.monthlyRupee = request.interestRupee ?? 2;

          this.runProfitCalculation();
        });
      }
    });
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
        this.errorMessage = 'The discount and the organizer’s commission together must be less than the total payout amount.';
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

  saveAsTermRecord(): void {
    if (!this.chitId || !this.discountAmount || !this.currentChitNumber) return;

    const isSelfPrized = this.hasPreviouslyWon
      ? false
      : confirm(`Did you win the payout in auction ${this.currentChitNumber}? Choose OK if you won, or Cancel to record a different winner.`);

    const termData = {
      chitId: this.chitId,
      termNumber: this.currentChitNumber,
      auctionDate: new Date().toISOString().split('T')[0],
      winningBidAmount: this.discountAmount,
      agentCommission: this.agentCommissionAmount ?? 0,
      totalDividend: 0,
      dividendPerMember: 0,
      netInstallmentPaid: isSelfPrized ? 0 : this.getAmountToBePaid(),
      isSelfPrized,
      payoutReceived: 0,
      notes: `Saved from the bid calculator with a discount of ₹${this.discountAmount}.`
    };

    this.chitService.addTerm(termData).subscribe(() => {
      this.saveSuccessMessage = `Auction ${this.currentChitNumber} saved.`;
      setTimeout(() => {
        void (async () => {
          this.saveSuccessMessage = null;
          await this.appAds.showInterstitialAtNaturalBreak();
          this.router.navigate(['/chits', this.chitId]);
        })();
      }, 1500);
    });
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

  get sliderStep(): number {
    return this.getDiscountUpperBound() < 500 ? 1 : 500;
  }

  get sliderMaximum(): number {
    return Math.floor(this.getDiscountUpperBound() / this.sliderStep) * this.sliderStep;
  }

  getShareAmount(): number {
    return (this.participants && this.participants > 0) ? (this.totalAmount || 0) / this.participants : 0;
  }

  getEligibleMembersCount(): number {
    if (!this.participants || this.participants <= 0) return 0;
    return getEligibleMemberCount(this.dividendDistributionType, this.participants, this.currentChitNumber || 1);
  }

  getDividendPool(): number {
    return getDividendPool(this.discountAmount || 0, this.agentCommissionAmount || 0, this.commissionTreatmentType);
  }

  getSharePerEligibleMember(): number {
    return getRoundedDividendPerMember(this.getDividendPool(), this.getEligibleMembersCount());
  }

  getDividendPerMember(): number {
    if (this.dividendDistributionType !== ChitType.ALWAYS_COMMISSION && this.hasPreviouslyWon) return 0;
    return this.getSharePerEligibleMember();
  }

  getAmountToBePaid(): number {
    if (!this.totalAmount || !this.participants || this.participants <= 0) {
      return 0;
    }
    const installment = this.totalAmount / this.participants;
    const dividend = this.getDividendPerMember();
    return Math.max(0, Math.round(installment - dividend));
  }

  onAmountToBePaidChange(newAmount: any): void {
    if (!this.totalAmount || !this.participants || this.participants <= 0) return;
    if (this.dividendDistributionType !== ChitType.ALWAYS_COMMISSION && this.hasPreviouslyWon) return;
    const val = (newAmount === null || newAmount === undefined || newAmount === '') ? null : Number(newAmount);
    if (val === null || !Number.isFinite(val) || val < 0) return;

    const installment = this.totalAmount / this.participants;
    const dividendPerMember = Math.max(0, installment - val);
    const eligible = this.getEligibleMembersCount();
    const dividendPool = dividendPerMember * eligible;
    const commission = this.agentCommissionAmount || 0;
    const calculatedDiscount = Math.round(this.commissionTreatmentType === CommissionTreatment.ADD_TO_DISCOUNT ? dividendPool - commission : dividendPool + commission);

    const maxDiscount = this.getDiscountUpperBound();
    this.discountAmount = Math.min(maxDiscount, Math.max(0, calculatedDiscount));
    this.onInputChange();
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
        alert('Couldn’t work out your gain or loss. Check the amounts and try again.');
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
      dividendDistributionType: this.dividendDistributionType,
      commissionTreatmentType: this.commissionTreatmentType,
      currentMemberDividend: this.getDividendPerMember(),
      previouslyWon: this.hasPreviouslyWon,
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
    this.waitResult = `You could gain an extra ₹${potentialFutureDiscount.toLocaleString()}`;
  }

  goBackToChit(): void {
    if (this.chitId) {
      this.router.navigate(['/chits', this.chitId]);
    } else {
      this.router.navigate(['/chits']);
    }
  }
}
