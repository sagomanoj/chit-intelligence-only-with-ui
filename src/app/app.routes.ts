import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { AuctionComponent } from './auction/auction';
import { ChitListComponent } from './chit-list/chit-list';
import { ChitCreateComponent } from './chit-create/chit-create';
import { ChitDetailComponent } from './chit-detail/chit-detail';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'chits', component: ChitListComponent },
  { path: 'chits/create', component: ChitCreateComponent },
  { path: 'chits/:id/edit', component: ChitCreateComponent },
  { path: 'chits/:id', component: ChitDetailComponent },
  { path: 'chits/:id/auction', component: AuctionComponent },
  { path: 'calculator', component: AuctionComponent },
  { path: '**', redirectTo: '/dashboard' },
];
