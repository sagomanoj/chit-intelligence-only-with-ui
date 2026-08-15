import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chit, ChitService } from '../services/chit.service';

@Component({
  selector: 'app-chit-list',
  imports: [CommonModule],
  templateUrl: './chit-list.html',
  styleUrl: './chit-list.css',
})
export class ChitListComponent implements OnInit {
  chits: Chit[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private chitService: ChitService, private router: Router) { }

  ngOnInit(): void {
    this.loadChits();
  }

  loadChits(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.chitService.getChits().subscribe({
      next: chits => {
        this.chits = chits;
        this.isLoading = false;
      },
      error: error => {
        this.isLoading = false;
        this.errorMessage = this.getErrorMessage(error, 'Unable to load saved chits.');
      }
    });
  }

  viewChit(id: string): void {
    this.router.navigate(['/chits', id]);
  }

  useInCalculator(id: string): void {
    this.errorMessage = '';
    try {
      this.chitService.setSelectedChitId(id);
      this.router.navigate(['/calculator']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error, 'Unable to select this chit.');
    }
  }

  createChit(): void {
    this.router.navigate(['/chits/create']);
  }

  getActiveCount(): number {
    return this.chits.filter(chit => chit.status === 'ACTIVE').length;
  }

  getTakenCount(): number {
    return this.chits.filter(chit => chit.status === 'TAKEN').length;
  }

  getCompletedCount(): number {
    return this.chits.filter(chit => chit.status === 'COMPLETED').length;
  }

  deleteChit(id: string): void {
    if (!confirm('Delete this chit and all its term records?')) {
      return;
    }

    this.errorMessage = '';
    this.chitService.deleteChit(id).subscribe({
      next: () => this.loadChits(),
      error: error => this.errorMessage = this.getErrorMessage(error, 'Unable to delete the chit.')
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
