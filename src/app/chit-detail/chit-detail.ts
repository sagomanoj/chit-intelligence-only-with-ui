import { SheetDirective } from '../sheet.directive';
import { AppAdsService } from '../services/app-ads.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChitService, Chit, ChitTerm } from '../services/chit.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChitType, CommissionTreatment, getDividendPool, getEligibleMemberCount, getRoundedDividendPerMember } from '../services/dividend-rules';

@Component({
  selector: 'app-chit-detail',
  imports: [SheetDirective, CommonModule, FormsModule],
  templateUrl: './chit-detail.html',
  styleUrl: './chit-detail.css',
})
export class ChitDetailComponent implements OnInit {
  readonly ChitType = ChitType;
  readonly CommissionTreatment = CommissionTreatment;
  chit: Chit | null = null;
  terms: ChitTerm[] = [];
  summary: any = null;

  showAddModal = false;
  isEditing = false;
  editingTermId: string | null = null;
  activeTooltip: string | null = null;

  toggleTooltip(field: string): void {
    this.activeTooltip = this.activeTooltip === field ? null : field;
  }

  newTerm = {
    termNumber: 1,
    auctionDate: new Date().toISOString().split('T')[0],
    winningBidAmount: 0,
    investmentAmount: 0,
    isSelfPrized: false,
    winnerName: '',
    notes: ''
  };

  constructor(
    private route: ActivatedRoute,
    private chitService: ChitService,
    private router: Router,
    private appAds: AppAdsService
  ) { }

  ngOnInit(): void {
    this.loadChitDetails();
  }

  get isSelfPrizedAlreadyWon(): boolean {
    if (!this.terms) return false;
    const prior = this.terms.find(t => t.isSelfPrized && (!this.isEditing || t.id !== this.editingTermId));
    return !!prior;
  }

  get selfPrizedTermNumber(): number | undefined {
    const prior = this.terms?.find(t => t.isSelfPrized && (!this.isEditing || t.id !== this.editingTermId));
    return prior?.termNumber;
  }

  get dividendPoolAmount(): number {
    if (!this.chit) return 0;
    return getDividendPool(this.newTerm.winningBidAmount || 0, this.chit.agentCommissionAmount || 0, this.chit.commissionTreatmentType ?? CommissionTreatment.DEDUCT_FROM_DISCOUNT);
  }

  get eligibleDividendMembers(): number {
    if (!this.chit) return 0;
    return getEligibleMemberCount(this.chit.dividendDistributionType ?? ChitType.STANDARD_NON_WINNERS_ONLY, this.chit.totalMembers, this.newTerm.termNumber);
  }

  get dividendPerEligibleMember(): number {
    return getRoundedDividendPerMember(this.dividendPoolAmount, this.eligibleDividendMembers);
  }

  get isUserEligibleForDividend(): boolean {
    return !!this.chit && (this.chit.dividendDistributionType === ChitType.ALWAYS_COMMISSION || (!this.newTerm.isSelfPrized && !this.isSelfPrizedAlreadyWon));
  }

  get userDividendForTerm(): number {
    return this.isUserEligibleForDividend ? this.dividendPerEligibleMember : 0;
  }

  loadChitDetails(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chitService.getChit(id).subscribe(chit => {
        if (chit) {
          this.chit = chit;
          this.chitService.getTerms(id).subscribe(terms => this.terms = terms);
          this.summary = this.chitService.getChitSummary(id);
          this.newTerm.termNumber = this.summary ? this.summary.nextTermNumber : 1;
          this.updateDefaultTermFields(this.newTerm.termNumber);
        }
      });
    }
  }

  payoutForTerm(term: ChitTerm): number {
    if (Number.isFinite(term.payoutReceived)) return term.payoutReceived;
    // Older backups can omit the stored payout amount.
    if (!this.chit) return 0;
    const contribution = this.chit.excludeCurrentTermShare === false ? 0 : this.chit.installmentAmount;
    return Math.max(0, this.chit.chitValue - term.winningBidAmount - (term.agentCommission || 0) - contribution);
  }

  get effectiveStartDate(): string | null {
    if (this.chit?.startDate) {
      return this.chit.startDate;
    }
    if (this.terms && this.terms.length > 0 && this.terms[0].auctionDate) {
      return this.terms[0].auctionDate;
    }
    return null;
  }

  get estimatedEndDate(): string | null {
    const start = this.effectiveStartDate;
    if (!start || !this.chit) return null;

    const monthsToAdd = (this.chit.totalMembers - 1) * (this.chit.frequencyInMonths || 1);
    return this.addMonthsToDate(start, monthsToAdd);
  }

  private addMonthsToDate(dateStr: string, months: number): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    d.setMonth(d.getMonth() + months);

    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d.toISOString().split('T')[0];
  }

  calculateDefaultAuctionDate(termNumber: number): string {
    if (!this.chit) return new Date().toISOString().split('T')[0];

    const frequency = this.chit.frequencyInMonths || 1;

    if (termNumber === 1) {
      if (this.chit.startDate) {
        return this.chit.startDate;
      }
      return new Date().toISOString().split('T')[0];
    }

    let refDateStr: string | null = null;
    let monthsToAdd = frequency;

    if (this.terms && this.terms.length > 0) {
      const prevTerm = this.terms.find(t => t.termNumber === termNumber - 1);
      if (prevTerm && prevTerm.auctionDate) {
        refDateStr = prevTerm.auctionDate;
        monthsToAdd = frequency;
      } else {
        const sorted = [...this.terms].sort((a, b) => b.termNumber - a.termNumber);
        const lastRecorded = sorted[0];
        if (lastRecorded && lastRecorded.auctionDate) {
          refDateStr = lastRecorded.auctionDate;
          const diffTerms = Math.max(1, termNumber - lastRecorded.termNumber);
          monthsToAdd = diffTerms * frequency;
        }
      }
    }

    if (!refDateStr && this.chit.startDate) {
      refDateStr = this.chit.startDate;
      monthsToAdd = (termNumber - 1) * frequency;
    }

    if (!refDateStr) {
      refDateStr = new Date().toISOString().split('T')[0];
      monthsToAdd = (termNumber - 1) * frequency;
    }

    return this.addMonthsToDate(refDateStr, monthsToAdd);
  }

  updateDefaultTermFields(termNumber: number): void {
    if (!this.chit) return;

    this.newTerm.auctionDate = this.calculateDefaultAuctionDate(termNumber);

    if (this.isSelfPrizedAlreadyWon && this.chit.dividendDistributionType !== ChitType.ALWAYS_COMMISSION) {
      this.newTerm.isSelfPrized = false;
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      this.newTerm.winningBidAmount = 0;
      this.newTerm.winnerName = `Cycle ${termNumber} winner`;
      this.newTerm.notes = '';
      return;
    }

    if (termNumber === this.chit.organizerPayoutTerm) {
      this.newTerm.winningBidAmount = this.chit.agentCommissionAmount || 0;
      this.newTerm.winnerName = 'Organizer';
      this.newTerm.notes = `Organizer’s payout in cycle ${termNumber}`;
    } else {
      this.newTerm.winningBidAmount = 0;
      this.newTerm.winnerName = `Cycle ${termNumber} winner`;
      this.newTerm.notes = '';
    }
    this.calculateInvestmentFromWinningBid();
  }

  calculateInvestmentFromWinningBid(): void {
    if (!this.chit) return;

    if (this.newTerm.isSelfPrized) {
      this.newTerm.investmentAmount = 0;
      return;
    }

    if (this.isSelfPrizedAlreadyWon && this.chit.dividendDistributionType !== ChitType.ALWAYS_COMMISSION) {
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      return;
    }

    this.newTerm.investmentAmount = Math.max(0, Math.round(this.chit.installmentAmount - this.userDividendForTerm));
  }

  onSelfPrizedChange(): void {
    if (this.newTerm.isSelfPrized) {
      this.newTerm.investmentAmount = 0;
    } else {
      this.calculateInvestmentFromWinningBid();
    }
  }

  onWinningBidChange(): void {
    this.calculateInvestmentFromWinningBid();
  }

  onInvestmentAmountChange(): void {
    if (!this.chit || this.newTerm.isSelfPrized) return;

    if (this.isSelfPrizedAlreadyWon && this.chit.dividendDistributionType !== ChitType.ALWAYS_COMMISSION) {
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      return;
    }

    const installment = this.chit.installmentAmount;
    const inv = this.newTerm.investmentAmount || 0;
    const dividendPerMember = Math.max(0, installment - inv);
    const pool = dividendPerMember * this.eligibleDividendMembers;
    const commission = this.chit.agentCommissionAmount || 0;
    this.newTerm.winningBidAmount = Math.max(0, Math.round(this.chit.commissionTreatmentType === CommissionTreatment.ADD_TO_DISCOUNT ? pool - commission : pool + commission));
  }

  onTermNumberChange(): void {
    if (!this.isEditing && this.chit) {
      this.updateDefaultTermFields(this.newTerm.termNumber);
    }
  }

  openAddTermModal(): void {
    if (this.summary?.isFullyCompleted) return;
    void this.appAds.prepareInterstitial();
    this.isEditing = false;
    this.editingTermId = null;
    this.newTerm.isSelfPrized = false;
    this.newTerm.termNumber = this.summary ? this.summary.nextTermNumber : 1;
    this.updateDefaultTermFields(this.newTerm.termNumber);
    this.showAddModal = true;
  }

  openEditTermModal(term: ChitTerm): void {
    this.isEditing = true;
    this.editingTermId = term.id;
    this.newTerm = {
      termNumber: term.termNumber,
      auctionDate: term.auctionDate || new Date().toISOString().split('T')[0],
      winningBidAmount: term.winningBidAmount,
      investmentAmount: term.netInstallmentPaid ?? (this.chit ? Math.max(0, this.chit.installmentAmount - term.dividendPerMember) : 0),
      isSelfPrized: term.isSelfPrized,
      winnerName: term.winnerName || '',
      notes: term.notes || ''
    };
    this.showAddModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
  }

  editChit(): void {
    if (this.chit) {
      this.router.navigate(['/chits', this.chit.id, 'edit']);
    }
  }

  saveTerm(): void {
    if (!this.chit) return;

    const termPayload = {
      ...(this.isEditing && this.editingTermId ? { id: this.editingTermId } : {}),
      chitId: this.chit.id,
      termNumber: this.newTerm.termNumber,
      auctionDate: this.newTerm.auctionDate,
      winningBidAmount: this.newTerm.winningBidAmount,
      agentCommission: this.chit.agentCommissionAmount,
      totalDividend: 0,
      dividendPerMember: 0,
      netInstallmentPaid: this.newTerm.investmentAmount,
      isSelfPrized: this.isSelfPrizedAlreadyWon ? false : this.newTerm.isSelfPrized,
      payoutReceived: 0,
      winnerName: this.newTerm.winnerName,
      notes: this.newTerm.notes
    };

    this.chitService.addTerm(termPayload).subscribe(() => {
      this.closeModal();
      this.loadChitDetails();
      if (!termPayload.id) void this.appAds.showInterstitialAtNaturalBreak();
    });
  }

  deleteTerm(termId: string, termNumber: number): void {
    if (confirm(`Delete the record for cycle ${termNumber}?`)) {
      this.chitService.deleteTerm(termId).subscribe(() => {
        this.loadChitDetails();
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/chits']);
  }

  goToAuction(): void {
    if (this.chit) {
      this.router.navigate(['/chits', this.chit.id, 'auction']);
    }
  }
}
