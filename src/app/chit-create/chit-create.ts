import { Component } from '@angular/core';
import { ChitService } from '../services/chit.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chit-create',
  imports: [FormsModule],
  templateUrl: './chit-create.html',
  styleUrl: './chit-create.css',
})
export class ChitCreateComponent {
  chit = {
    name: '',
    chitValue: 0,
    totalMembers: 0,
    installmentAmount: 0,
    organizerPayoutTerm: 0,
    dividendDistributionType: 2, // default NON_PRIZED_ONLY
    startDate: ''
  };

  constructor(private chitService: ChitService, private router: Router) { }

  create(): void {
    this.chitService.createChit(this.chit).subscribe(() => {
      this.router.navigate(['/chits']);
    });
  }
}
