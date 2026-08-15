import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChitService, ChitType, ChitUpsertRequest } from '../services/chit.service';

@Component({
  selector: 'app-chit-create',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chit-create.html',
  styleUrl: './chit-create.css',
})
export class ChitCreateComponent {
  submitted = false;
  isSaving = false;
  errorMessage = '';
  readonly monthOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  chit: ChitUpsertRequest = {
    name: '',
    chitAmount: 0,
    totalMembers: 0,
    frequencyInMonths: 1,
    startDate: '',
    chitType: 'NO_COMMISSION',
    currentTermNumber: 0,
    openingPastInvestment: 0,
    agentCommissionAmount: 0,
    notes: ''
  };

  constructor(private chitService: ChitService, private router: Router) { }

  create(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (!this.isFormValid()) {
      return;
    }

    this.isSaving = true;
    this.chitService.createChit(this.chit).subscribe({
      next: chit => {
        this.isSaving = false;
        this.router.navigate(['/chits', chit.id]);
      },
      error: error => {
        this.isSaving = false;
        this.errorMessage = error instanceof Error ? error.message : 'Unable to save the chit. Please try again.';
      }
    });
  }

  showCommissionAmount(): boolean {
    return this.chit.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM';
  }

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

  getChitTypeHelp(): string {
    return this.chitTypes.find(type => type.value === this.chit.chitType)?.help ?? '';
  }

  isFormValid(): boolean {
    return !!(
      this.chit.name.trim() &&
      Number.isFinite(this.chit.chitAmount) && this.chit.chitAmount > 0 &&
      Number.isInteger(this.chit.totalMembers) && this.chit.totalMembers > 0 &&
      Number.isInteger(this.chit.frequencyInMonths) && this.chit.frequencyInMonths > 0 &&
      this.chit.frequencyInMonths <= 8 &&
      this.chit.startDate &&
      Number.isInteger(this.chit.currentTermNumber) && this.chit.currentTermNumber >= 0 &&
      this.chit.currentTermNumber <= this.chit.totalMembers &&
      Number.isFinite(this.chit.openingPastInvestment) && this.chit.openingPastInvestment >= 0 &&
      (!this.showCommissionAmount() || this.chit.agentCommissionAmount !== undefined &&
        Number.isFinite(this.chit.agentCommissionAmount) && this.chit.agentCommissionAmount >= 0)
    );
  }

  isFieldInvalid(fieldName: keyof ChitUpsertRequest): boolean {
    if (!this.submitted) {
      return false;
    }

    switch (fieldName) {
      case 'name':
        return !this.chit.name.trim();
      case 'chitAmount':
        return !Number.isFinite(this.chit.chitAmount) || this.chit.chitAmount <= 0;
      case 'totalMembers':
        return !Number.isInteger(this.chit.totalMembers) || this.chit.totalMembers <= 0;
      case 'frequencyInMonths':
        return !Number.isInteger(this.chit.frequencyInMonths) || this.chit.frequencyInMonths <= 0 || this.chit.frequencyInMonths > 8;
      case 'startDate':
        return !this.chit.startDate;
      case 'currentTermNumber':
        return !Number.isInteger(this.chit.currentTermNumber) || this.chit.currentTermNumber < 0 || this.chit.currentTermNumber > this.chit.totalMembers;
      case 'openingPastInvestment':
        return !Number.isFinite(this.chit.openingPastInvestment) || this.chit.openingPastInvestment < 0;
      case 'agentCommissionAmount':
        return this.showCommissionAmount() && (this.chit.agentCommissionAmount === undefined ||
          !Number.isFinite(this.chit.agentCommissionAmount) || this.chit.agentCommissionAmount < 0);
      case 'notes':
        return false;
      case 'chitType':
        return false;
      default:
        return false;
    }
  }
}
