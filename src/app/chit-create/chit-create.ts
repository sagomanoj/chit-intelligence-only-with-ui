import { Component, OnInit } from '@angular/core';
import { ChitService, Chit } from '../services/chit.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chit-create',
  imports: [FormsModule, CommonModule],
  templateUrl: './chit-create.html',
  styleUrl: './chit-create.css',
})
export class ChitCreateComponent implements OnInit {
  isEditMode = false;
  chitId: string | null = null;
  activeTooltip: string | null = null;

  toggleTooltip(field: string): void {
    this.activeTooltip = this.activeTooltip === field ? null : field;
  }

  chit: {
    id?: string;
    name: string;
    chitValue: number | null;
    totalMembers: number | null;
    installmentAmount: number;
    frequencyInMonths: number;
    agentCommissionPercent: number;
    agentCommissionAmount: number;
    organizerPayoutTerm: number;
    dividendDistributionType: number;
    startDate?: string;
    status: 'ACTIVE' | 'COMPLETED' | 'DRAFT';
    reinvestmentDefaults?: {
      enableReinvestment: boolean;
      annualInterest?: number;
      monthlyRupee?: number;
    };
  } = {
    name: '',
    chitValue: null,
    totalMembers: null,
    installmentAmount: 0,
    frequencyInMonths: 1,
    agentCommissionPercent: 0,
    agentCommissionAmount: 0,
    organizerPayoutTerm: 1,
    dividendDistributionType: 2, // NON_PRIZED_ONLY
    startDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    reinvestmentDefaults: {
      enableReinvestment: true,
      annualInterest: 24,
      monthlyRupee: 2
    }
  };

  constructor(
    private chitService: ChitService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.chitId = id;
      this.chitService.getChit(id).subscribe(existingChit => {
        if (existingChit) {
          this.chit = { ...existingChit };
        } else {
          alert('Chit group not found.');
          this.router.navigate(['/chits']);
        }
      });
    }
  }

  onValuesChange(): void {
    if (this.chit.totalMembers && this.chit.totalMembers > 0 && this.chit.chitValue && this.chit.chitValue > 0) {
      this.chit.installmentAmount = Math.round(this.chit.chitValue / this.chit.totalMembers);
    } else {
      this.chit.installmentAmount = 0;
    }
    if (this.chit.totalMembers && this.chit.organizerPayoutTerm > this.chit.totalMembers) {
      this.chit.organizerPayoutTerm = this.chit.totalMembers;
    }
    this.onCommissionPercentChange();
  }

  onCommissionPercentChange(): void {
    if (this.chit.chitValue && this.chit.chitValue > 0 && this.chit.agentCommissionPercent >= 0) {
      this.chit.agentCommissionAmount = Math.round((this.chit.chitValue * this.chit.agentCommissionPercent) / 100);
    }
  }

  onCommissionAmountChange(): void {
    if (this.chit.chitValue && this.chit.chitValue > 0 && this.chit.agentCommissionAmount >= 0) {
      this.chit.agentCommissionPercent = parseFloat(((this.chit.agentCommissionAmount / this.chit.chitValue) * 100).toFixed(2));
    }
  }

  save(): void {
    if (!this.chit.name || !this.chit.chitValue || this.chit.chitValue <= 0 || !this.chit.totalMembers || this.chit.totalMembers <= 0) {
      alert('Please fill out all required fields with valid numbers.');
      return;
    }

    if (this.chit.organizerPayoutTerm > this.chit.totalMembers) {
      alert(`Organizer Payout Term cannot exceed Total Members (${this.chit.totalMembers}).`);
      return;
    }

    const chitPayload = {
      name: this.chit.name,
      chitValue: Number(this.chit.chitValue),
      totalMembers: Number(this.chit.totalMembers),
      installmentAmount: this.chit.installmentAmount,
      frequencyInMonths: this.chit.frequencyInMonths,
      agentCommissionPercent: this.chit.agentCommissionPercent,
      agentCommissionAmount: this.chit.agentCommissionAmount,
      organizerPayoutTerm: this.chit.organizerPayoutTerm,
      dividendDistributionType: this.chit.dividendDistributionType,
      startDate: this.chit.startDate,
      status: this.chit.status,
      reinvestmentDefaults: this.chit.reinvestmentDefaults
    };

    if (this.isEditMode && this.chitId) {
      const updatedChit: Chit = {
        ...chitPayload,
        id: this.chitId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.chitService.updateChit(updatedChit).subscribe(() => {
        this.router.navigate(['/chits', this.chitId]);
      });
    } else {
      this.chitService.createChit(chitPayload).subscribe(() => {
        this.router.navigate(['/chits']);
      });
    }
  }

  cancel(): void {
    if (this.isEditMode && this.chitId) {
      this.router.navigate(['/chits', this.chitId]);
    } else {
      this.router.navigate(['/chits']);
    }
  }
}
