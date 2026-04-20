import { Component, OnInit } from '@angular/core';
import { ChitService, Chit } from '../services/chit.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  createChit(): void {
    this.router.navigate(['/chits/create']);
  }
}
