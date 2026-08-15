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
  readonly monthOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  newTerm: ChitTermUpsertRequest = {
    termNumber: 0,
    termDate: '',
    isChitTaken: false,
    investedAmount: 0,
    takenAmount: 0,
    notes: ''
  };

  readonly chitTypes: Array<{ value: ChitType; label: string }> = [
    { value: 'NO_COMMISSION', label: 'No commission' },
    { value: 'AGENT_FIXED_AMOUNT_EACH_TERM', label: 'Agent fixed amount each term' },
    { value: 'AGENT_ONE_EXTRA_CHIT', label: 'Agent one extra chit' }
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
  }

  cancelEdit(): void {
    if (!this.chit) {
      return;
    }

    this.isEditing = false;
    this.editSubmitted = false;
    this.editModel = this.toEditModel(this.chit);
  }

  saveChit(): void {
    if (!this.chit || !this.editModel) {
      return;
    }

    this.editSubmitted = true;
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
      error: error => alert(error?.message ?? 'Unable to update chit.')
    });
  }

  deleteChit(): void {
    if (!this.chit || !confirm('Delete this chit and all of its term records?')) {
      return;
    }

    this.chitService.deleteChit(this.chit.id).subscribe(() => {
      this.router.navigate(['/chits']);
    });
  }

  addTerm(): void {
    if (!this.chit) {
      return;
    }

    this.termSubmitted = true;
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
      error: error => alert(error?.message ?? 'Unable to add term.')
    });
  }

  useInCalculator(): void {
    if (!this.chit) {
      return;
    }

    this.chitService.setSelectedChitId(this.chit.id);
    this.router.navigate(['/calculator']);
  }

  toggleTaken(): void {
    if (!this.chit) {
      return;
    }

    if (this.newTerm.isChitTaken && !this.newTerm.takenAmount) {
      this.newTerm.takenAmount = this.chit.installmentAmount;
    }
  }

  showCommissionAmount(): boolean {
    return Boolean(this.editModel && this.editModel.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM');
  }

  showTakenAmount(): boolean {
    return this.newTerm.isChitTaken;
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
        return this.editModel.chitAmount <= 0;
      case 'totalMembers':
        return this.editModel.totalMembers <= 0;
      case 'frequencyInMonths':
        return this.editModel.frequencyInMonths <= 0 || this.editModel.frequencyInMonths > 8;
      case 'startDate':
        return !this.editModel.startDate;
      case 'currentTermNumber':
        return this.editModel.currentTermNumber < 0 || this.editModel.currentTermNumber > this.editModel.totalMembers;
      case 'openingPastInvestment':
        return this.editModel.openingPastInvestment < 0;
      case 'agentCommissionAmount':
        return this.showCommissionAmount() && (this.editModel.agentCommissionAmount === undefined || this.editModel.agentCommissionAmount < 0);
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
        return this.newTerm.termNumber <= 0;
      case 'termDate':
        return !this.newTerm.termDate;
      case 'investedAmount':
        return this.newTerm.investedAmount === undefined || this.newTerm.investedAmount < 0;
      case 'takenAmount':
        return this.newTerm.isChitTaken && (this.newTerm.takenAmount === undefined || this.newTerm.takenAmount < 0);
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
      this.editModel.chitAmount > 0 &&
      this.editModel.totalMembers > 0 &&
      this.editModel.frequencyInMonths > 0 &&
      this.editModel.frequencyInMonths <= 8 &&
      this.editModel.startDate &&
      this.editModel.currentTermNumber >= 0 &&
      this.editModel.currentTermNumber <= this.editModel.totalMembers &&
      this.editModel.openingPastInvestment >= 0 &&
      (!this.showCommissionAmount() || this.editModel.agentCommissionAmount !== undefined && this.editModel.agentCommissionAmount >= 0)
    );
  }

  private isTermValid(): boolean {
    return !!(
      this.newTerm.termNumber > 0 &&
      this.newTerm.termDate &&
      this.newTerm.investedAmount !== undefined &&
      this.newTerm.investedAmount >= 0 &&
      (!this.newTerm.isChitTaken || this.newTerm.takenAmount !== undefined && this.newTerm.takenAmount >= 0)
    );
  }

  private loadChit(id: string): void {
    this.chitService.getChit(id).subscribe(chit => {
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
    });
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
