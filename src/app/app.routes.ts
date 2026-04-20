import { Routes } from '@angular/router';
import { AuctionComponent } from './auction/auction';

export const routes: Routes = [
  { path: '', redirectTo: '/calculator', pathMatch: 'full' },
  { path: 'calculator', component: AuctionComponent },
  { path: '**', redirectTo: '/calculator' },
];
