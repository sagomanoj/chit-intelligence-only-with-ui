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
  newTerm = {
    termNumber: 0,
    winningAmount: 0,
    discountAmount: 0,
    isSelfPrized: false
  };

  constructor(private route: ActivatedRoute, private chitService: ChitService, private router: Router) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chitService.getChit(id).subscribe(chit => this.chit = chit);
    }
  }

  addTerm(): void {
    if (this.chit) {
      this.chitService.addTerm(this.chit.id, this.newTerm).subscribe(() => {
        this.ngOnInit(); // reload
      });
    }
  }

  goToAuction(): void {
    if (this.chit) {
      this.router.navigate(['/chits', this.chit.id, 'auction']);
    }
  }
}
