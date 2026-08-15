import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Chit, ChitService, ChitTermUpsertRequest, ChitType, ChitUpsertRequest } from '../services/chit.service';

@Component({
  selector: 'app-chit-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './chit-detail.html',
  styleUrl: './chit-detail.css',
})
export class ChitDetailComponent implements OnInit {
  chit: Chit | null = null;
  editModel: ChitUpsertRequest | null = null;
  isEditing = false;
  editSubmitted = false;
  termSubmitted = false;
  saveNotice = '';
  errorMessage = '';
  readonly monthOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  newTerm: ChitTermUpsertRequest = {
    termNumber: 0,
    termDate: '',
    isChitTaken: false,
    investedAmount: 0,
    takenAmount: 0,
    notes: ''
  };

  readonly chitTypes: Array<{ value: ChitType; label: string; help: string }> = [
    { value: 'NO_COMMISSION', label: 'No commission', help: 'No agent commission deduction is applied.' },
    {
      value: 'AGENT_FIXED_AMOUNT_EACH_TERM',
      label: 'Agent fixed amount each term',
      help: 'The fixed amount is deducted at each auction; a winning member incurs it once in that auction calculation.'
    },
    {
      value: 'AGENT_ONE_EXTRA_CHIT',
      label: 'Agent one extra chit',
      help: 'Include the agent reserved ticket in Total Members and the term count. No cash commission is deducted.'
    }
  ];

  constructor(private route: ActivatedRoute, private chitService: ChitService, private router: Router) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/chits']);
      return;
    }

    this.loadChit(id);
  }

  beginEdit(): void {
    if (!this.chit) {
      return;
    }

    this.isEditing = true;
    this.editSubmitted = false;
    this.saveNotice = '';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    if (!this.chit) {
      return;
    }

    this.isEditing = false;
    this.editSubmitted = false;
    this.errorMessage = '';
    this.editModel = this.toEditModel(this.chit);
  }

  saveChit(): void {
    if (!this.chit || !this.editModel) {
      return;
    }

    this.editSubmitted = true;
    this.errorMessage = '';
    if (!this.isEditValid()) {
      return;
    }

    this.chitService.updateChit(this.chit.id, this.editModel).subscribe({
      next: chit => {
        this.chit = chit;
        this.editModel = this.toEditModel(chit);
        this.isEditing = false;
        this.editSubmitted = false;
        this.saveNotice = 'Chit updated successfully.';
      },
      error: error => this.errorMessage = this.getErrorMessage(error, 'Unable to update chit.')
    });
  }

  deleteChit(): void {
    if (!this.chit || !confirm('Delete this chit and all of its term records?')) {
      return;
    }

    this.errorMessage = '';
    this.chitService.deleteChit(this.chit.id).subscribe({
      next: () => this.router.navigate(['/chits']),
      error: error => this.errorMessage = this.getErrorMessage(error, 'Unable to delete chit.')
    });
  }

  addTerm(): void {
    if (!this.chit) {
      return;
    }

    this.termSubmitted = true;
    this.errorMessage = '';
    if (!this.isTermValid()) {
      return;
    }

    this.chitService.addTerm(this.chit.id, {
      ...this.newTerm,
      investedAmount: this.newTerm.investedAmount ?? this.chit.installmentAmount,
      takenAmount: this.newTerm.isChitTaken ? this.newTerm.takenAmount : undefined
    }).subscribe({
      next: () => {
        this.termSubmitted = false;
        this.newTerm = {
          termNumber: this.chit ? this.chit.currentTermNumber + 1 : 1,
          termDate: this.getSuggestedNextDate(),
          isChitTaken: false,
          investedAmount: this.chit?.installmentAmount ?? 0,
          takenAmount: 0,
          notes: ''
        };
        this.loadChit(this.chit!.id);
      },
      error: error => this.errorMessage = this.getErrorMessage(error, 'Unable to add term.')
    });
  }

  useInCalculator(): void {
    if (!this.chit) {
      return;
    }

    this.errorMessage = '';
    try {
      this.chitService.setSelectedChitId(this.chit.id);
      this.router.navigate(['/calculator']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error, 'Unable to select this chit.');
    }
  }

  toggleTaken(): void {
    if (!this.chit) {
      return;
    }

    if (this.newTerm.isChitTaken && (!this.newTerm.takenAmount || this.newTerm.takenAmount <= 0)) {
      this.newTerm.takenAmount = this.chit.installmentAmount;
    }
  }

  showCommissionAmount(): boolean {
    return Boolean(this.editModel && this.editModel.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM');
  }

  showTakenAmount(): boolean {
    return this.newTerm.isChitTaken;
  }

  getChitTypeHelp(): string {
    return this.chitTypes.find(type => type.value === this.editModel?.chitType)?.help ?? '';
  }

  getExpectedNextTerm(): number {
    return (this.chit?.currentTermNumber ?? 0) + 1;
  }

  getMinimumTotalMembers(): number {
    return Math.max(1, this.chit?.currentTermNumber ?? 0);
  }

  getPastInvestment(): number {
    return this.chit ? this.chitService.getPastInvestment(this.chit) : 0;
  }

  isEditFieldInvalid(fieldName: keyof ChitUpsertRequest): boolean {
    if (!this.editSubmitted || !this.editModel) {
      return false;
    }

    switch (fieldName) {
      case 'name':
        return !this.editModel.name.trim();
      case 'chitAmount':
        return !Number.isFinite(this.editModel.chitAmount) || this.editModel.chitAmount <= 0;
      case 'totalMembers':
        return !Number.isInteger(this.editModel.totalMembers) || this.editModel.totalMembers < this.getMinimumTotalMembers();
      case 'frequencyInMonths':
        return !Number.isInteger(this.editModel.frequencyInMonths) || this.editModel.frequencyInMonths <= 0 || this.editModel.frequencyInMonths > 8;
      case 'startDate':
        return !this.editModel.startDate;
      case 'currentTermNumber':
        return !Number.isInteger(this.editModel.currentTermNumber) || this.editModel.currentTermNumber < 0 ||
          this.editModel.currentTermNumber > this.editModel.totalMembers ||
          Boolean(this.chit?.terms.length && this.editModel.currentTermNumber !== this.chit.currentTermNumber);
      case 'openingPastInvestment':
        return !Number.isFinite(this.editModel.openingPastInvestment) || this.editModel.openingPastInvestment < 0;
      case 'agentCommissionAmount':
        return this.showCommissionAmount() && (this.editModel.agentCommissionAmount === undefined ||
          !Number.isFinite(this.editModel.agentCommissionAmount) || this.editModel.agentCommissionAmount < 0);
      case 'notes':
      case 'chitType':
        return false;
      default:
        return false;
    }
  }

  isTermFieldInvalid(fieldName: keyof ChitTermUpsertRequest): boolean {
    if (!this.termSubmitted) {
      return false;
    }

    switch (fieldName) {
      case 'termNumber':
        return !Number.isInteger(this.newTerm.termNumber) || this.newTerm.termNumber !== this.getExpectedNextTerm();
      case 'termDate':
        return !this.newTerm.termDate;
      case 'investedAmount':
        return this.newTerm.investedAmount === undefined || !Number.isFinite(this.newTerm.investedAmount) || this.newTerm.investedAmount < 0;
      case 'takenAmount':
        return this.newTerm.isChitTaken && (this.newTerm.takenAmount === undefined ||
          !Number.isFinite(this.newTerm.takenAmount) || this.newTerm.takenAmount <= 0);
      case 'isChitTaken':
      case 'notes':
        return false;
      default:
        return false;
    }
  }

  private isEditValid(): boolean {
    if (!this.editModel) {
      return false;
    }

    return !!(
      this.editModel.name.trim() &&
      Number.isFinite(this.editModel.chitAmount) && this.editModel.chitAmount > 0 &&
      Number.isInteger(this.editModel.totalMembers) && this.editModel.totalMembers >= this.getMinimumTotalMembers() &&
      Number.isInteger(this.editModel.frequencyInMonths) && this.editModel.frequencyInMonths > 0 &&
      this.editModel.frequencyInMonths <= 8 &&
      this.editModel.startDate &&
      Number.isInteger(this.editModel.currentTermNumber) && this.editModel.currentTermNumber >= 0 &&
      this.editModel.currentTermNumber <= this.editModel.totalMembers &&
      (!this.chit?.terms.length || this.editModel.currentTermNumber === this.chit.currentTermNumber) &&
      Number.isFinite(this.editModel.openingPastInvestment) && this.editModel.openingPastInvestment >= 0 &&
      (!this.showCommissionAmount() || this.editModel.agentCommissionAmount !== undefined &&
        Number.isFinite(this.editModel.agentCommissionAmount) && this.editModel.agentCommissionAmount >= 0)
    );
  }

  private isTermValid(): boolean {
    return !!(
      Number.isInteger(this.newTerm.termNumber) && this.newTerm.termNumber === this.getExpectedNextTerm() &&
      this.newTerm.termDate &&
      this.newTerm.investedAmount !== undefined &&
      Number.isFinite(this.newTerm.investedAmount) &&
      this.newTerm.investedAmount >= 0 &&
      (!this.newTerm.isChitTaken || this.newTerm.takenAmount !== undefined &&
        Number.isFinite(this.newTerm.takenAmount) && this.newTerm.takenAmount > 0)
    );
  }

  private loadChit(id: string): void {
    this.errorMessage = '';
    this.chitService.getChit(id).subscribe({
      next: chit => {
        if (!chit) {
          this.router.navigate(['/chits']);
          return;
        }

        this.chit = chit;
        this.editModel = this.toEditModel(chit);
        this.newTerm = {
          termNumber: chit.currentTermNumber + 1,
          termDate: this.getSuggestedNextDate(chit),
          isChitTaken: false,
          investedAmount: chit.installmentAmount,
          takenAmount: chit.installmentAmount,
          notes: ''
        };
      },
      error: error => this.errorMessage = this.getErrorMessage(error, 'Unable to load this chit.')
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private toEditModel(chit: Chit): ChitUpsertRequest {
    return {
      name: chit.name,
      chitAmount: chit.chitAmount,
      totalMembers: chit.totalMembers,
      frequencyInMonths: chit.frequencyInMonths,
      startDate: chit.startDate,
      chitType: chit.chitType,
      currentTermNumber: chit.currentTermNumber,
      openingPastInvestment: chit.openingPastInvestment,
      agentCommissionAmount: chit.agentCommissionAmount ?? 0,
      notes: chit.notes ?? ''
    };
  }

  private getSuggestedNextDate(chit?: Chit): string {
    const source = chit ?? this.chit;
    if (!source?.nextScheduledDate) {
      return '';
    }

    return source.nextScheduledDate;
  }
}
