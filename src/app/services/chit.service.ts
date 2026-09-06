import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LocalStorageService, Chit, ChitTerm, AppDataSchema } from './local-storage.service';

export type { Chit, ChitTerm, AppDataSchema };

@Injectable({
  providedIn: 'root'
})
export class ChitService {
  constructor(private storage: LocalStorageService) { }

  getChits(): Observable<Chit[]> {
    return this.storage.getChits();
  }

  getChit(id: string): Observable<Chit | undefined> {
    return of(this.storage.getChitById(id));
  }

  createChit(chit: Omit<Chit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Observable<Chit> {
    const created = this.storage.saveChit(chit);
    return of(created);
  }

  updateChit(chit: Chit): Observable<Chit> {
    const updated = this.storage.saveChit(chit);
    return of(updated);
  }

  deleteChit(id: string): Observable<boolean> {
    return of(this.storage.deleteChit(id));
  }

  getTerms(chitId: string): Observable<ChitTerm[]> {
    return of(this.storage.getTermsByChitId(chitId));
  }

  getTermsSync(chitId: string): ChitTerm[] {
    return this.storage.getTermsByChitId(chitId);
  }

  addTerm(term: Omit<ChitTerm, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Observable<ChitTerm> {
    const saved = this.storage.saveTermTransaction(term);
    return of(saved);
  }

  deleteTerm(termId: string): Observable<boolean> {
    return of(this.storage.deleteTermTransaction(termId));
  }

  getChitSummary(chitId: string) {
    return this.storage.getChitSummary(chitId);
  }

  exportData(): string {
    return this.storage.exportDataToJson();
  }

  importData(jsonContent: string): boolean {
    return this.storage.importDataFromJson(jsonContent);
  }
}