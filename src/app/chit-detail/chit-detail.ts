import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChitService, Chit, ChitTerm } from '../services/chit.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chit-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './chit-detail.html',
  styleUrl: './chit-detail.css',
})
export class ChitDetailComponent implements OnInit {
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
    private router: Router
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

    if (this.isSelfPrizedAlreadyWon) {
      this.newTerm.isSelfPrized = false;
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      this.newTerm.winningBidAmount = 0;
      this.newTerm.winnerName = `Term ${termNumber} Winner`;
      this.newTerm.notes = '';
      return;
    }

    if (termNumber === this.chit.organizerPayoutTerm) {
      this.newTerm.winningBidAmount = this.chit.agentCommissionAmount || 0;
      this.newTerm.winnerName = 'Organizer';
      this.newTerm.notes = `Term ${termNumber} Organizer Payout`;
    } else {
      this.newTerm.winningBidAmount = 0;
      this.newTerm.winnerName = `Term ${termNumber} Winner`;
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

    if (this.isSelfPrizedAlreadyWon) {
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      return;
    }

    const agentCommission = this.chit.agentCommissionAmount || 0;
    const totalDividend = Math.max(0, (this.newTerm.winningBidAmount || 0) - agentCommission);
    const eligibleMembers = Math.max(1, this.chit.totalMembers - this.newTerm.termNumber);
    
    const dividendPerMember = eligibleMembers > 0 ? totalDividend / eligibleMembers : 0;
    this.newTerm.investmentAmount = Math.max(0, Math.round(this.chit.installmentAmount - dividendPerMember));
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

    if (this.isSelfPrizedAlreadyWon) {
      this.newTerm.investmentAmount = this.chit.installmentAmount;
      return;
    }

    const installment = this.chit.installmentAmount;
    const inv = this.newTerm.investmentAmount || 0;
    const dividendPerMember = Math.max(0, installment - inv);
    
    const eligibleMembers = Math.max(1, this.chit.totalMembers - this.newTerm.termNumber);

    const totalDividend = dividendPerMember * eligibleMembers;
    const agentCommission = this.chit.agentCommissionAmount || 0;
    this.newTerm.winningBidAmount = Math.round(totalDividend + agentCommission);
  }

  onTermNumberChange(): void {
    if (!this.isEditing && this.chit) {
      this.updateDefaultTermFields(this.newTerm.termNumber);
    }
  }

  openAddTermModal(): void {
    if (this.summary?.isFullyCompleted) return;
    this.isEditing = false;
    this.editingTermId = null;
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
    });
  }

  deleteTerm(termId: string, termNumber: number): void {
    if (confirm(`Delete Term ${termNumber} record?`)) {
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
