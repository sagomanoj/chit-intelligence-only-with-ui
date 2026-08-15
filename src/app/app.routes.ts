import { Routes } from '@angular/router';
import { AuctionComponent } from './auction/auction';
import { ChitCreateComponent } from './chit-create/chit-create';
import { ChitDetailComponent } from './chit-detail/chit-detail';
import { ChitListComponent } from './chit-list/chit-list';

export const routes: Routes = [
  { path: '', redirectTo: '/calculator', pathMatch: 'full' },
  { path: 'calculator', component: AuctionComponent },
  { path: 'chits', component: ChitListComponent },
  { path: 'chits/create', component: ChitCreateComponent },
  { path: 'chits/:id', component: ChitDetailComponent },
  { path: '**', redirectTo: '/calculator' },
];
