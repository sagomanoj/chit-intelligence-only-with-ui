import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

export type ChitStatus = 'ACTIVE' | 'TAKEN' | 'COMPLETED';
export type ChitType = 'NO_COMMISSION' | 'AGENT_FIXED_AMOUNT_EACH_TERM' | 'AGENT_ONE_EXTRA_CHIT';

export interface ChitTerm {
  termId: string;
  chitId: string;
  termNumber: number;
  termDate: string;
  isChitTaken: boolean;
  takenAmount?: number;
  investedAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chit {
  id: string;
  name: string;
  chitAmount: number;
  totalMembers: number;
  frequencyInMonths: number;
  startDate: string;
  chitType: ChitType;
  status: ChitStatus;
  currentTermNumber: number;
  openingPastInvestment: number;
  agentCommissionAmount?: number;
  isChitTaken: boolean;
  takenTermNumber?: number;
  takenDate?: string;
  takenAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  terms: ChitTerm[];
  termsCompleted: number;
  termsPending: number;
  remainingChits: number;
  nextScheduledDate: string;
  endDate: string;
  installmentAmount: number;
}

export interface ChitUpsertRequest {
  name: string;
  chitAmount: number;
  totalMembers: number;
  frequencyInMonths: number;
  startDate: string;
  chitType: ChitType;
  currentTermNumber: number;
  openingPastInvestment: number;
  agentCommissionAmount?: number;
  notes?: string;
}

export interface ChitTermUpsertRequest {
  termNumber: number;
  termDate: string;
  isChitTaken: boolean;
  investedAmount?: number;
  takenAmount?: number;
  notes?: string;
}

interface StoredChit extends ChitUpsertRequest {
  id: string;
  status: ChitStatus;
  isChitTaken: boolean;
  takenTermNumber?: number;
  takenDate?: string;
  takenAmount?: number;
  createdAt: string;
  updatedAt: string;
  terms: ChitTerm[];
}

@Injectable({
  providedIn: 'root'
})
export class ChitService {
  private readonly storageKey = 'chit-intelligence.local.chits';
  private readonly selectedKey = 'chit-intelligence.local.selected-chit-id';

  getChits(): Observable<Chit[]> {
    return of(this.readChits().map(chit => this.hydrateChit(chit)));
  }

  getChit(id: string): Observable<Chit | null> {
    const chit = this.readChits().find(item => item.id === id);
    return of(chit ? this.hydrateChit(chit) : null);
  }

  createChit(chit: ChitUpsertRequest): Observable<Chit> {
    if (!chit.name.trim()) {
      return throwError(() => new Error('Chit name is required.'));
    }

    if (chit.chitAmount <= 0 || chit.totalMembers <= 0) {
      return throwError(() => new Error('Chit amount and total members must be greater than zero.'));
    }

    if (chit.frequencyInMonths <= 0) {
      return throwError(() => new Error('Frequency must be greater than zero.'));
    }

    if (!chit.startDate) {
      return throwError(() => new Error('Start date is required.'));
    }

    if (chit.currentTermNumber < 0 || chit.currentTermNumber > chit.totalMembers) {
      return throwError(() => new Error('Current term number cannot exceed total members.'));
    }

    const now = this.now();
    const record: StoredChit = {
      id: this.createId('chit'),
      name: chit.name.trim(),
      chitAmount: chit.chitAmount,
      totalMembers: chit.totalMembers,
      frequencyInMonths: chit.frequencyInMonths,
      startDate: chit.startDate,
      chitType: chit.chitType,
      currentTermNumber: Math.max(0, Math.floor(chit.currentTermNumber || 0)),
      openingPastInvestment: Math.max(0, chit.openingPastInvestment || 0),
      agentCommissionAmount: this.cleanNumber(chit.agentCommissionAmount),
      notes: chit.notes?.trim() || '',
      status: 'ACTIVE',
      isChitTaken: false,
      createdAt: now,
      updatedAt: now,
      terms: []
    };

    const chits = this.readChits();
    chits.unshift(record);
    this.writeChits(chits);

    return of(this.hydrateChit(record));
  }

  updateChit(id: string, chit: Partial<ChitUpsertRequest>): Observable<Chit> {
    const chits = this.readChits();
    const index = chits.findIndex(item => item.id === id);

    if (index < 0) {
      return throwError(() => new Error('Chit not found.'));
    }

    const current = chits[index];
    const updated: StoredChit = {
      ...current,
      name: chit.name !== undefined ? chit.name.trim() : current.name,
      chitAmount: chit.chitAmount !== undefined ? chit.chitAmount : current.chitAmount,
      totalMembers: chit.totalMembers !== undefined ? chit.totalMembers : current.totalMembers,
      frequencyInMonths: chit.frequencyInMonths !== undefined ? chit.frequencyInMonths : current.frequencyInMonths,
      startDate: chit.startDate !== undefined ? chit.startDate : current.startDate,
      chitType: chit.chitType !== undefined ? chit.chitType : current.chitType,
      currentTermNumber: chit.currentTermNumber !== undefined ? Math.max(0, Math.floor(chit.currentTermNumber)) : current.currentTermNumber,
      openingPastInvestment: chit.openingPastInvestment !== undefined ? Math.max(0, chit.openingPastInvestment) : current.openingPastInvestment,
      agentCommissionAmount: chit.agentCommissionAmount !== undefined ? this.cleanNumber(chit.agentCommissionAmount) : current.agentCommissionAmount,
      notes: chit.notes !== undefined ? chit.notes.trim() : current.notes,
      updatedAt: this.now()
    };

    if (!updated.startDate) {
      return throwError(() => new Error('Start date is required.'));
    }

    if (updated.currentTermNumber < 0 || updated.currentTermNumber > updated.totalMembers) {
      return throwError(() => new Error('Current term number cannot exceed total members.'));
    }

    chits[index] = updated;
    this.writeChits(chits);

    return of(this.hydrateChit(updated));
  }

  deleteChit(id: string): Observable<void> {
    const next = this.readChits().filter(item => item.id !== id);
    this.writeChits(next);

    if (this.getSelectedChitId() === id) {
      this.setSelectedChitId(null);
    }

    return of(void 0);
  }

  addTerm(chitId: string, term: ChitTermUpsertRequest): Observable<ChitTerm> {
    if (term.termNumber <= 0) {
      return throwError(() => new Error('Term number must be greater than zero.'));
    }

    if (!term.termDate) {
      return throwError(() => new Error('Term date is required.'));
    }

    const chits = this.readChits();
    const index = chits.findIndex(item => item.id === chitId);

    if (index < 0) {
      return throwError(() => new Error('Chit not found.'));
    }

    const chit = chits[index];
    if (term.termNumber > chit.totalMembers) {
      return throwError(() => new Error('Term number cannot exceed total members.'));
    }

    const duplicateTerm = chit.terms.find(item => item.termNumber === term.termNumber);
    if (duplicateTerm) {
      return throwError(() => new Error('Term number already exists for this chit.'));
    }

    if (term.isChitTaken && chit.terms.some(item => item.isChitTaken)) {
      return throwError(() => new Error('This chit has already been marked as taken.'));
    }

    const now = this.now();
    const installmentAmount = this.getInstallmentAmount(chit.chitAmount, chit.totalMembers);
    const sanitizedInvestedAmount = this.cleanNumber(term.investedAmount);
    const sanitizedTakenAmount = term.isChitTaken ? this.cleanNumber(term.takenAmount) : undefined;

    const termRecord: ChitTerm = {
      termId: this.createId('term'),
      chitId,
      termNumber: term.termNumber,
      termDate: term.termDate,
      isChitTaken: term.isChitTaken,
      investedAmount: sanitizedInvestedAmount ?? installmentAmount,
      takenAmount: sanitizedTakenAmount,
      notes: term.notes?.trim() || '',
      createdAt: now,
      updatedAt: now
    };

    chit.terms = [...chit.terms, termRecord].sort((left, right) => left.termNumber - right.termNumber);
    chit.currentTermNumber = Math.max(chit.currentTermNumber, term.termNumber);
    chit.updatedAt = now;
    this.syncChitSummary(chit);

    chits[index] = chit;
    this.writeChits(chits);

    return of(termRecord);
  }

  getTerms(chitId: string): Observable<ChitTerm[]> {
    const chit = this.readChits().find(item => item.id === chitId);
    return of(this.cloneTerms(chit?.terms ?? []).sort((left, right) => left.termNumber - right.termNumber));
  }

  setSelectedChitId(chitId: string | null): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    if (chitId) {
      storage.setItem(this.selectedKey, chitId);
    } else {
      storage.removeItem(this.selectedKey);
    }
  }

  getSelectedChitId(): string | null {
    const storage = this.getStorage();
    return storage ? storage.getItem(this.selectedKey) : null;
  }

  getInstallmentAmount(chitAmount: number, totalMembers: number): number {
    if (chitAmount <= 0 || totalMembers <= 0) {
      return 0;
    }

    return this.roundAmount(chitAmount / totalMembers);
  }

  getPastInvestment(chit: Chit): number {
    const termInvestment = chit.terms.reduce((sum, item) => sum + (item.investedAmount ?? 0), 0);
    return this.roundAmount(chit.openingPastInvestment + termInvestment);
  }

  private readChits(): StoredChit[] {
    const storage = this.getStorage();
    if (!storage) {
      return [];
    }

    const raw = storage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as StoredChit[];
      return Array.isArray(parsed) ? parsed.map(item => this.normalizeStoredChit(item)) : [];
    } catch {
      return [];
    }
  }

  private writeChits(chits: StoredChit[]): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    storage.setItem(this.storageKey, JSON.stringify(chits));
  }

  private hydrateChit(chit: StoredChit): Chit {
    this.syncChitSummary(chit);

    return {
      ...chit,
      terms: this.cloneTerms(chit.terms),
      termsCompleted: chit.currentTermNumber,
      termsPending: Math.max(0, chit.totalMembers - chit.currentTermNumber),
      remainingChits: Math.max(0, chit.totalMembers - chit.currentTermNumber),
      installmentAmount: this.getInstallmentAmount(chit.chitAmount, chit.totalMembers),
      nextScheduledDate: chit.status === 'COMPLETED'
        ? ''
        : this.calculateNextScheduledDate(chit.startDate, chit.frequencyInMonths, chit.currentTermNumber),
      endDate: this.calculateEndDate(chit.startDate, chit.frequencyInMonths, chit.totalMembers)
    };
  }

  private syncChitSummary(chit: StoredChit): void {
    const takenTerm = chit.terms.find(item => item.isChitTaken);
    const latestTermNumber = chit.terms.reduce((max, item) => Math.max(max, item.termNumber), chit.currentTermNumber);
    chit.currentTermNumber = Math.min(Math.max(0, latestTermNumber), chit.totalMembers);
    chit.isChitTaken = Boolean(takenTerm);
    chit.takenTermNumber = takenTerm?.termNumber;
    chit.takenDate = takenTerm?.termDate;
    chit.takenAmount = takenTerm?.takenAmount;

    if (chit.currentTermNumber >= chit.totalMembers) {
      chit.status = 'COMPLETED';
    } else if (chit.isChitTaken) {
      chit.status = 'TAKEN';
    } else {
      chit.status = 'ACTIVE';
    }
  }

  private calculateNextScheduledDate(startDate: string, frequencyInMonths: number, currentTermNumber: number): string {
    if (!startDate) {
      return '';
    }

    const offset = Math.max(0, currentTermNumber) * Math.max(1, frequencyInMonths);
    return this.formatDate(this.addMonths(new Date(startDate), offset));
  }

  private calculateEndDate(startDate: string, frequencyInMonths: number, totalMembers: number): string {
    if (!startDate || totalMembers <= 0) {
      return '';
    }

    const offset = Math.max(0, totalMembers - 1) * Math.max(1, frequencyInMonths);
    return this.formatDate(this.addMonths(new Date(startDate), offset));
  }

  private normalizeStoredChit(chit: StoredChit): StoredChit {
    return {
      ...chit,
      currentTermNumber: Math.max(0, Math.floor(chit.currentTermNumber || 0)),
      openingPastInvestment: Math.max(0, this.cleanNumber(chit.openingPastInvestment) ?? 0),
      agentCommissionAmount: this.cleanNumber(chit.agentCommissionAmount),
      terms: this.cloneTerms(chit.terms ?? [])
    };
  }

  private cloneTerms(terms: ChitTerm[]): ChitTerm[] {
    return terms.map(item => ({ ...item }));
  }

  private cleanNumber(value?: number): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private createId(prefix: string): string {
    const cryptoObject = globalThis.crypto as Crypto | undefined;
    const id = cryptoObject?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${id}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private getStorage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
