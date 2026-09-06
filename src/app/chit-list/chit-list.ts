import { Component, OnInit } from '@angular/core';
import { ChitService, Chit } from '../services/chit.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChitSummaryItem {
  chit: Chit;
  termsCompleted: number;
  totalInvested: number;
  totalDividendEarned: number;
  isSelfPrized: boolean;
  payoutReceived: number;
  progressPercent: number;
}

@Component({
  selector: 'app-chit-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './chit-list.html',
  styleUrl: './chit-list.css',
})
export class ChitListComponent implements OnInit {
  chitSummaries: ChitSummaryItem[] = [];
  importError: string | null = null;
  importSuccess: string | null = null;

  searchQuery: string = '';
  activeTab: 'ALL' | 'ONGOING' | 'COMPLETED' = 'ALL';

  constructor(private chitService: ChitService, private router: Router) { }

  get filteredChits(): ChitSummaryItem[] {
    return this.chitSummaries.filter(item => {
      const matchesSearch = !this.searchQuery ||
        item.chit.name.toLowerCase().includes(this.searchQuery.trim().toLowerCase());

      const isCompleted = item.chit.status === 'COMPLETED' || item.termsCompleted >= item.chit.totalMembers;
      const matchesTab = this.activeTab === 'ALL'
        || (this.activeTab === 'ONGOING' && !isCompleted)
        || (this.activeTab === 'COMPLETED' && isCompleted);

      return matchesSearch && matchesTab;
    });
  }

  get ongoingCount(): number {
    return this.chitSummaries.filter(item => item.chit.status !== 'COMPLETED' && item.termsCompleted < item.chit.totalMembers).length;
  }

  get completedCount(): number {
    return this.chitSummaries.filter(item => item.chit.status === 'COMPLETED' || item.termsCompleted >= item.chit.totalMembers).length;
  }

  setTab(tab: 'ALL' | 'ONGOING' | 'COMPLETED'): void {
    this.activeTab = tab;
  }

  ngOnInit(): void {
    this.loadChits();
  }

  loadChits(): void {
    this.chitService.getChits().subscribe(chits => {
      this.chitSummaries = chits.map(chit => {
        const summary = this.chitService.getChitSummary(chit.id);
        const termsCompleted = summary ? summary.termsCompleted : 0;
        const totalInvested = summary ? summary.totalInvested : 0;
        const totalDividendEarned = summary ? summary.totalDividendEarned : 0;
        const isSelfPrized = summary ? summary.isSelfPrized : false;
        const payoutReceived = summary ? summary.payoutReceived : 0;
        const progressPercent = chit.totalMembers > 0
          ? Math.min(100, Math.round((termsCompleted / chit.totalMembers) * 100))
          : 0;

        return {
          chit,
          termsCompleted,
          totalInvested,
          totalDividendEarned,
          isSelfPrized,
          payoutReceived,
          progressPercent
        };
      });
    });
  }

  viewChit(id: string): void {
    this.router.navigate(['/chits', id]);
  }

  editChit(event: Event, id: string): void {
    event.stopPropagation();
    this.router.navigate(['/chits', id, 'edit']);
  }

  openCalculator(id: string): void {
    this.router.navigate(['/chits', id, 'auction']);
  }

  createChit(): void {
    this.router.navigate(['/chits/create']);
  }

  deleteChit(event: Event, id: string, name: string): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}" and all its term history?`)) {
      this.chitService.deleteChit(id).subscribe(() => {
        this.loadChits();
      });
    }
  }

  exportData(): void {
    const jsonStr = this.chitService.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chit_intelligence_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const success = this.chitService.importData(content);
          if (success) {
            this.importSuccess = 'Data successfully imported from JSON file!';
            this.importError = null;
            this.loadChits();
            setTimeout(() => this.importSuccess = null, 4000);
          }
        } catch (err: any) {
          this.importError = err.message || 'Failed to import JSON file. Please check structure.';
          this.importSuccess = null;
        }
      };
      reader.readAsText(file);
    }
  }
}
