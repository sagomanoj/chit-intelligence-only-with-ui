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
    if (!this.isFormValid()) {
      return;
    }

    this.chitService.createChit(this.chit).subscribe(chit => {
      this.router.navigate(['/chits', chit.id]);
    });
  }

  showCommissionAmount(): boolean {
    return this.chit.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM';
  }

  readonly chitTypes: Array<{ value: ChitType; label: string }> = [
    { value: 'NO_COMMISSION', label: 'No commission' },
    { value: 'AGENT_FIXED_AMOUNT_EACH_TERM', label: 'Agent fixed amount each term' },
    { value: 'AGENT_ONE_EXTRA_CHIT', label: 'Agent one extra chit' }
  ];

  isFormValid(): boolean {
    return !!(
      this.chit.name.trim() &&
      this.chit.chitAmount > 0 &&
      this.chit.totalMembers > 0 &&
      this.chit.frequencyInMonths > 0 &&
      this.chit.frequencyInMonths <= 8 &&
      this.chit.startDate &&
      this.chit.currentTermNumber >= 0 &&
      this.chit.currentTermNumber <= this.chit.totalMembers &&
      this.chit.openingPastInvestment >= 0 &&
      (!this.showCommissionAmount() || this.chit.agentCommissionAmount !== undefined && this.chit.agentCommissionAmount >= 0)
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
        return this.chit.chitAmount <= 0;
      case 'totalMembers':
        return this.chit.totalMembers <= 0;
      case 'frequencyInMonths':
        return this.chit.frequencyInMonths <= 0 || this.chit.frequencyInMonths > 8;
      case 'startDate':
        return !this.chit.startDate;
      case 'currentTermNumber':
        return this.chit.currentTermNumber < 0 || this.chit.currentTermNumber > this.chit.totalMembers;
      case 'openingPastInvestment':
        return this.chit.openingPastInvestment < 0;
      case 'agentCommissionAmount':
        return this.showCommissionAmount() && (this.chit.agentCommissionAmount === undefined || this.chit.agentCommissionAmount < 0);
      case 'notes':
        return false;
      case 'chitType':
        return false;
      default:
        return false;
    }
  }
}
