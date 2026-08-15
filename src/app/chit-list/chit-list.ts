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

  constructor(private chitService: ChitService, private router: Router) { }

  ngOnInit(): void {
    this.loadChits();
  }

  loadChits(): void {
    this.chitService.getChits().subscribe(chits => this.chits = chits);
  }

  viewChit(id: string): void {
    this.router.navigate(['/chits', id]);
  }

  useInCalculator(id: string): void {
    this.chitService.setSelectedChitId(id);
    this.router.navigate(['/calculator']);
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

    this.chitService.deleteChit(id).subscribe(() => this.loadChits());
  }
}
