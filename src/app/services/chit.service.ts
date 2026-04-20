import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Chit {
  id: string;
  name: string;
  chitValue: number;
  totalMembers: number;
  installmentAmount: number;
  organizerPayoutTerm: number;
  dividendDistributionType: number;
  startDate?: string;
  terms: ChitTerm[];
}

export interface ChitTerm {
  id: string;
  chitId: string;
  termNumber: number;
  winningAmount: number;
  discountAmount: number;
  isSelfPrized: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChitService {
  private apiUrl = 'http://localhost:5288/api'; // adjust port

  constructor(private http: HttpClient) { }

  getChits(): Observable<Chit[]> {
    return this.http.get<Chit[]>(`${this.apiUrl}/chits`);
  }

  getChit(id: string): Observable<Chit> {
    return this.http.get<Chit>(`${this.apiUrl}/chits/${id}`);
  }

  createChit(chit: Omit<Chit, 'id' | 'terms'>): Observable<Chit> {
    return this.http.post<Chit>(`${this.apiUrl}/chits`, chit);
  }

  addTerm(chitId: string, term: Omit<ChitTerm, 'id' | 'chitId'>): Observable<ChitTerm> {
    return this.http.post<ChitTerm>(`${this.apiUrl}/chits/${chitId}/terms`, term);
  }

  getTerms(chitId: string): Observable<ChitTerm[]> {
    return this.http.get<ChitTerm[]>(`${this.apiUrl}/chits/${chitId}/terms`);
  }
}