import { Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';

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
    return defer(() => of(this.readChits().map(chit => this.hydrateChit(chit))));
  }

  getChit(id: string): Observable<Chit | null> {
    return defer(() => {
      const chit = this.readChits().find(item => item.id === id);
      return of(chit ? this.hydrateChit(chit) : null);
    });
  }

  createChit(chit: ChitUpsertRequest): Observable<Chit> {
    return defer(() => {
      this.validateChit(chit);

      const now = this.now();
      const record: StoredChit = {
        id: this.createId('chit'),
        name: chit.name.trim(),
        chitAmount: chit.chitAmount,
        totalMembers: chit.totalMembers,
        frequencyInMonths: chit.frequencyInMonths,
        startDate: chit.startDate,
        chitType: chit.chitType,
        currentTermNumber: chit.currentTermNumber,
        openingPastInvestment: chit.openingPastInvestment,
        agentCommissionAmount: chit.agentCommissionAmount,
        notes: chit.notes?.trim() || '',
        status: 'ACTIVE',
        isChitTaken: false,
        createdAt: now,
        updatedAt: now,
        terms: []
      };

      this.syncChitSummary(record);
      const chits = this.readChits();
      chits.unshift(record);
      this.writeChits(chits);

      return of(this.hydrateChit(record));
    });
  }

  updateChit(id: string, chit: Partial<ChitUpsertRequest>): Observable<Chit> {
    return defer(() => {
      const chits = this.readChits();
      const index = chits.findIndex(item => item.id === id);

      if (index < 0) {
        throw new Error('Chit not found.');
      }

      const current = chits[index];
      const candidate: ChitUpsertRequest = {
        name: chit.name !== undefined ? chit.name : current.name,
        chitAmount: chit.chitAmount !== undefined ? chit.chitAmount : current.chitAmount,
        totalMembers: chit.totalMembers !== undefined ? chit.totalMembers : current.totalMembers,
        frequencyInMonths: chit.frequencyInMonths !== undefined ? chit.frequencyInMonths : current.frequencyInMonths,
        startDate: chit.startDate !== undefined ? chit.startDate : current.startDate,
        chitType: chit.chitType !== undefined ? chit.chitType : current.chitType,
        currentTermNumber: chit.currentTermNumber !== undefined ? chit.currentTermNumber : current.currentTermNumber,
        openingPastInvestment: chit.openingPastInvestment !== undefined ? chit.openingPastInvestment : current.openingPastInvestment,
        agentCommissionAmount: chit.agentCommissionAmount !== undefined ? chit.agentCommissionAmount : current.agentCommissionAmount,
        notes: chit.notes !== undefined ? chit.notes : current.notes
      };

      this.validateChit(candidate);

      const highestRecordedTerm = this.getHighestRecordedTerm(current.terms);
      if (candidate.totalMembers < highestRecordedTerm) {
        throw new Error(`Total members cannot be less than recorded term ${highestRecordedTerm}.`);
      }

      if (current.terms.length > 0 && candidate.currentTermNumber !== current.currentTermNumber) {
        throw new Error('Current term number cannot be changed after term records have been added.');
      }

      const updated: StoredChit = {
        ...current,
        ...candidate,
        name: candidate.name.trim(),
        notes: candidate.notes?.trim() || '',
        updatedAt: this.now()
      };

      this.syncChitSummary(updated);
      chits[index] = updated;
      this.writeChits(chits);

      return of(this.hydrateChit(updated));
    });
  }

  deleteChit(id: string): Observable<void> {
    return defer(() => {
      const next = this.readChits().filter(item => item.id !== id);
      const wasSelected = this.getSelectedChitId() === id;
      this.writeChits(next);

      if (wasSelected) {
        this.setSelectedChitId(null);
      }

      return of(void 0);
    });
  }

  addTerm(chitId: string, term: ChitTermUpsertRequest): Observable<ChitTerm> {
    return defer(() => {
      this.validateTerm(term);

      const chits = this.readChits();
      const index = chits.findIndex(item => item.id === chitId);

      if (index < 0) {
        throw new Error('Chit not found.');
      }

      const chit = chits[index];
      const expectedTermNumber = chit.currentTermNumber + 1;
      if (expectedTermNumber > chit.totalMembers) {
        throw new Error('All terms for this chit have already been completed.');
      }

      if (term.termNumber !== expectedTermNumber) {
        throw new Error(`The next term must be term ${expectedTermNumber}.`);
      }

      if (chit.terms.some(item => item.termNumber === term.termNumber)) {
        throw new Error('Term number already exists for this chit.');
      }

      if (term.isChitTaken && chit.terms.some(item => item.isChitTaken)) {
        throw new Error('This chit has already been marked as taken.');
      }

      const now = this.now();
      const installmentAmount = this.getInstallmentAmount(chit.chitAmount, chit.totalMembers);
      const termRecord: ChitTerm = {
        termId: this.createId('term'),
        chitId,
        termNumber: term.termNumber,
        termDate: term.termDate,
        isChitTaken: term.isChitTaken,
        investedAmount: term.investedAmount ?? installmentAmount,
        takenAmount: term.isChitTaken ? term.takenAmount : undefined,
        notes: term.notes?.trim() || '',
        createdAt: now,
        updatedAt: now
      };

      chit.terms = [...chit.terms, termRecord].sort((left, right) => left.termNumber - right.termNumber);
      chit.currentTermNumber = term.termNumber;
      chit.updatedAt = now;
      this.syncChitSummary(chit);

      chits[index] = chit;
      this.writeChits(chits);

      return of({ ...termRecord });
    });
  }

  getTerms(chitId: string): Observable<ChitTerm[]> {
    return defer(() => {
      const chit = this.readChits().find(item => item.id === chitId);
      return of(this.cloneTerms(chit?.terms ?? []).sort((left, right) => left.termNumber - right.termNumber));
    });
  }

  setSelectedChitId(chitId: string | null): void {
    const storage = this.getStorage();
    try {
      if (chitId) {
        storage.setItem(this.selectedKey, chitId);
      } else {
        storage.removeItem(this.selectedKey);
      }
    } catch (error) {
      throw this.createStorageError('save the selected chit', error);
    }
  }

  getSelectedChitId(): string | null {
    const storage = this.getStorage();
    try {
      return storage.getItem(this.selectedKey);
    } catch (error) {
      throw this.createStorageError('read the selected chit', error);
    }
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
    let raw: string | null;
    try {
      raw = storage.getItem(this.storageKey);
    } catch (error) {
      throw this.createStorageError('read saved chit data', error);
    }

    if (!raw) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Saved chit data is corrupted and could not be read. Clear the saved data or restore a valid backup.');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Saved chit data is corrupted and could not be read. Clear the saved data or restore a valid backup.');
    }

    try {
      return parsed.map(item => this.normalizeStoredChit(item));
    } catch {
      throw new Error('Saved chit data is corrupted and could not be read. Clear the saved data or restore a valid backup.');
    }
  }

  private writeChits(chits: StoredChit[]): void {
    const storage = this.getStorage();
    try {
      storage.setItem(this.storageKey, JSON.stringify(chits));
    } catch (error) {
      throw this.createStorageError('save chit data', error);
    }
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
    return this.formatDate(this.addMonths(this.parseDate(startDate), offset));
  }

  private calculateEndDate(startDate: string, frequencyInMonths: number, totalMembers: number): string {
    if (!startDate || totalMembers <= 0) {
      return '';
    }

    const offset = Math.max(0, totalMembers - 1) * Math.max(1, frequencyInMonths);
    return this.formatDate(this.addMonths(this.parseDate(startDate), offset));
  }

  private normalizeStoredChit(value: unknown): StoredChit {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid chit record.');
    }

    const chit = value as StoredChit;
    const normalized: StoredChit = {
      ...chit,
      openingPastInvestment: chit.openingPastInvestment ?? 0,
      terms: this.cloneTerms(chit.terms ?? [])
    };

    this.validateStoredChit(normalized);
    this.syncChitSummary(normalized);
    return normalized;
  }

  private cloneTerms(terms: ChitTerm[]): ChitTerm[] {
    return terms.map(item => ({ ...item }));
  }

  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private addMonths(date: Date, months: number): Date {
    const originalDay = date.getUTCDate();
    const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const lastDayOfTargetMonth = new Date(Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth() + 1,
      0
    )).getUTCDate();

    return new Date(Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(originalDay, lastDayOfTargetMonth)
    ));
  }

  private formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private createId(prefix: string): string {
    const cryptoObject = globalThis.crypto as Crypto | undefined;
    const id = cryptoObject?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${id}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private validateChit(chit: ChitUpsertRequest): void {
    if (typeof chit.name !== 'string' || !chit.name.trim()) {
      throw new Error('Chit name is required.');
    }

    if (!Number.isFinite(chit.chitAmount) || chit.chitAmount <= 0) {
      throw new Error('Chit amount must be greater than zero.');
    }

    if (!Number.isInteger(chit.totalMembers) || chit.totalMembers <= 0) {
      throw new Error('Total members must be a whole number greater than zero.');
    }

    if (!Number.isInteger(chit.frequencyInMonths) || chit.frequencyInMonths <= 0 || chit.frequencyInMonths > 8) {
      throw new Error('Frequency must be a whole number between 1 and 8 months.');
    }

    if (!this.isValidDate(chit.startDate)) {
      throw new Error('A valid start date is required.');
    }

    if (!this.isChitType(chit.chitType)) {
      throw new Error('A valid chit type is required.');
    }

    if (!Number.isInteger(chit.currentTermNumber) || chit.currentTermNumber < 0 || chit.currentTermNumber > chit.totalMembers) {
      throw new Error('Current term number must be a whole number between 0 and total members.');
    }

    if (!Number.isFinite(chit.openingPastInvestment) || chit.openingPastInvestment < 0) {
      throw new Error('Opening past investment must be 0 or a positive amount.');
    }

    if (chit.chitType === 'AGENT_FIXED_AMOUNT_EACH_TERM') {
      if (chit.agentCommissionAmount === undefined || !Number.isFinite(chit.agentCommissionAmount) || chit.agentCommissionAmount < 0) {
        throw new Error('Agent commission must be 0 or a positive amount.');
      }
    } else if (chit.agentCommissionAmount !== undefined && (!Number.isFinite(chit.agentCommissionAmount) || chit.agentCommissionAmount < 0)) {
      throw new Error('Agent commission must be 0 or a positive amount.');
    }
  }

  private validateTerm(term: ChitTermUpsertRequest): void {
    if (!Number.isInteger(term.termNumber) || term.termNumber <= 0) {
      throw new Error('Term number must be a whole number greater than zero.');
    }

    if (!this.isValidDate(term.termDate)) {
      throw new Error('A valid term date is required.');
    }

    if (term.investedAmount !== undefined && (!Number.isFinite(term.investedAmount) || term.investedAmount < 0)) {
      throw new Error('Invested amount must be 0 or a positive amount.');
    }

    if (term.isChitTaken && (term.takenAmount === undefined || !Number.isFinite(term.takenAmount) || term.takenAmount <= 0)) {
      throw new Error('Taken amount must be greater than zero when the chit is marked as taken.');
    }
  }

  private validateStoredChit(chit: StoredChit): void {
    if (typeof chit.id !== 'string' || !chit.id || !Array.isArray(chit.terms)) {
      throw new Error('Invalid chit record.');
    }

    this.validateChit(chit);

    const seenTerms = new Set<number>();
    for (const term of chit.terms) {
      if (!term || typeof term !== 'object' || typeof term.termId !== 'string' || typeof term.chitId !== 'string') {
        throw new Error('Invalid term record.');
      }

      this.validateTerm(term);
      if (term.termNumber > chit.totalMembers || seenTerms.has(term.termNumber)) {
        throw new Error('Invalid term record.');
      }
      seenTerms.add(term.termNumber);
    }
  }

  private getHighestRecordedTerm(terms: ChitTerm[]): number {
    return terms.reduce((highest, term) => Math.max(highest, term.termNumber), 0);
  }

  private isChitType(value: ChitType): boolean {
    return value === 'NO_COMMISSION' || value === 'AGENT_FIXED_AMOUNT_EACH_TERM' || value === 'AGENT_ONE_EXTRA_CHIT';
  }

  private isValidDate(value: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private createStorageError(action: string, error: unknown): Error {
    const errorName = error && typeof error === 'object' && 'name' in error
      ? String(error.name)
      : '';
    if (errorName === 'QuotaExceededError' || errorName === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return new Error('Unable to save chit data because browser storage is full. Free some storage and try again.');
    }

    return new Error(`Unable to ${action}. Browser storage may be blocked or unavailable.`);
  }

  private getStorage(): Storage {
    try {
      const storage = globalThis.localStorage;
      if (!storage) {
        throw new Error('Storage is missing.');
      }
      return storage;
    } catch {
      throw new Error('Browser storage is unavailable. Enable local storage and try again.');
    }
  }
}
