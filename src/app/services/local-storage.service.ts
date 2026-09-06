import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface UserSettings {
  schemaVersion: string;
  currencySymbol: string;
  defaultAnnualInterest: number;
  defaultMonthlyRupee: number;
  lastBackupDate?: string;
  syncMode: 'LOCAL_JSON' | 'GOOGLE_DRIVE';
}

export interface Chit {
  id: string;
  name: string;
  chitValue: number;
  totalMembers: number;
  installmentAmount: number;
  frequencyInMonths: number;
  agentCommissionPercent: number;
  agentCommissionAmount: number;
  dividendDistributionType: number; // 1: All members, 2: Non-prized only
  organizerPayoutTerm: number;
  startDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DRAFT';
  reinvestmentDefaults?: {
    enableReinvestment: boolean;
    annualInterest?: number;
    monthlyRupee?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChitTerm {
  id: string;
  chitId: string;
  termNumber: number;
  auctionDate: string;
  winningBidAmount: number; // Discount Amount
  agentCommission: number;
  totalDividend: number; // winningBidAmount - agentCommission
  dividendPerMember: number;
  netInstallmentPaid: number; // installmentAmount - dividendPerMember
  isSelfPrized: boolean;
  payoutReceived: number; // Chit Value - winningBidAmount - agentCommission (if self prized)
  winnerName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppDataSchema {
  version: string;
  exportedAt: string;
  settings: UserSettings;
  chits: Chit[];
  termTransactions: ChitTerm[];
}

export interface IStorageProvider {
  loadData(): Observable<AppDataSchema>;
  saveData(data: AppDataSchema): Observable<boolean>;
}

const STORAGE_KEY = 'chit_intelligence_data_v1';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService implements IStorageProvider {
  private dataSubject = new BehaviorSubject<AppDataSchema>(this.getInitialData());
  public data$ = this.dataSubject.asObservable();

  constructor() {
    this.initData();
  }

  private getInitialData(): AppDataSchema {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: {
        schemaVersion: '1.0.0',
        currencySymbol: 'Rs.',
        defaultAnnualInterest: 24,
        defaultMonthlyRupee: 2,
        syncMode: 'LOCAL_JSON'
      },
      chits: [],
      termTransactions: []
    };
  }

  private initData(): void {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      this.seedSampleDataIfEmpty();
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppDataSchema;
        this.dataSubject.next(parsed);
      } else {
        this.seedSampleDataIfEmpty();
      }
    } catch (e) {
      console.error('Failed to parse local storage data, using initial data:', e);
      this.seedSampleDataIfEmpty();
    }
  }

  private seedSampleDataIfEmpty(): void {
    const initial = this.getInitialData();
    // Add a sample chit for immediate usability
    const sampleChitId = 'chit-sample-1';
    const sampleChit: Chit = {
      id: sampleChitId,
      name: 'Sample 5 Lakhs (20 Months)',
      chitValue: 500000,
      totalMembers: 20,
      installmentAmount: 25000,
      frequencyInMonths: 1,
      agentCommissionPercent: 5,
      agentCommissionAmount: 25000,
      dividendDistributionType: 1,
      organizerPayoutTerm: 1,
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      reinvestmentDefaults: {
        enableReinvestment: true,
        annualInterest: 24,
        monthlyRupee: 2
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sampleTerms: ChitTerm[] = [
      {
        id: 'term-sample-1',
        chitId: sampleChitId,
        termNumber: 1,
        auctionDate: new Date().toISOString().split('T')[0],
        winningBidAmount: 25000,
        agentCommission: 25000,
        totalDividend: 0,
        dividendPerMember: 0,
        netInstallmentPaid: 25000,
        isSelfPrized: false,
        payoutReceived: 0,
        winnerName: 'Organizer',
        notes: 'Term 1 Organizer Payout',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'term-sample-2',
        chitId: sampleChitId,
        termNumber: 2,
        auctionDate: new Date().toISOString().split('T')[0],
        winningBidAmount: 100000,
        agentCommission: 25000,
        totalDividend: 75000,
        dividendPerMember: 3750,
        netInstallmentPaid: 21250,
        isSelfPrized: false,
        payoutReceived: 0,
        winnerName: 'Participant A',
        notes: 'Term 2 Auction Winner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    initial.chits = [sampleChit];
    initial.termTransactions = sampleTerms;
    this.persist(initial);
  }

  private persist(data: AppDataSchema): void {
    data.exportedAt = new Date().toISOString();
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to write to localStorage:', e);
      }
    }
    this.dataSubject.next(data);
  }

  loadData(): Observable<AppDataSchema> {
    return of(this.dataSubject.value);
  }

  saveData(data: AppDataSchema): Observable<boolean> {
    this.persist(data);
    return of(true);
  }

  // --- CRUD Operations ---

  getChits(): Observable<Chit[]> {
    return of(this.dataSubject.value.chits);
  }

  getChitById(id: string): Chit | undefined {
    return this.dataSubject.value.chits.find(c => c.id === id);
  }

  saveChit(chit: Omit<Chit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Chit {
    const current = { ...this.dataSubject.value };
    const now = new Date().toISOString();
    let savedChit: Chit;

    if (chit.id) {
      const index = current.chits.findIndex(c => c.id === chit.id);
      if (index >= 0) {
        savedChit = {
          ...current.chits[index],
          ...chit,
          updatedAt: now
        } as Chit;
        current.chits[index] = savedChit;
      } else {
        savedChit = { ...chit, id: chit.id, createdAt: now, updatedAt: now } as Chit;
        current.chits.push(savedChit);
      }
    } else {
      const id = 'chit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      savedChit = { ...chit, id, createdAt: now, updatedAt: now } as Chit;
      current.chits.push(savedChit);
    }

    this.persist(current);
    return savedChit;
  }

  deleteChit(id: string): boolean {
    const current = { ...this.dataSubject.value };
    current.chits = current.chits.filter(c => c.id !== id);
    current.termTransactions = current.termTransactions.filter(t => t.chitId !== id);
    this.persist(current);
    return true;
  }

  getTermsByChitId(chitId: string): ChitTerm[] {
    return this.dataSubject.value.termTransactions
      .filter(t => t.chitId === chitId)
      .sort((a, b) => a.termNumber - b.termNumber);
  }

  private syncChitStatus(chitId: string, data: AppDataSchema): void {
    const chitIndex = data.chits.findIndex(c => c.id === chitId);
    if (chitIndex >= 0) {
      const chit = data.chits[chitIndex];
      const termsCount = data.termTransactions.filter(t => t.chitId === chitId).length;
      const newStatus = termsCount >= chit.totalMembers ? 'COMPLETED' : 'ACTIVE';
      if (chit.status !== newStatus) {
        data.chits[chitIndex] = {
          ...chit,
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
      }
    }
  }

  saveTermTransaction(term: Omit<ChitTerm, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ChitTerm {
    const current = { ...this.dataSubject.value };
    const now = new Date().toISOString();
    const chit = this.getChitById(term.chitId);

    if (!chit) {
      throw new Error(`Chit with ID ${term.chitId} not found`);
    }

    // Auto-calculate financial fields
    const agentCommission = term.agentCommission ?? chit.agentCommissionAmount;
    const totalDividend = Math.max(0, term.winningBidAmount - agentCommission);
    const eligibleMembers = Math.max(1, chit.totalMembers - term.termNumber);
    const dividendPerMember = eligibleMembers > 0 ? totalDividend / eligibleMembers : 0;
    const netInstallmentPaid = term.isSelfPrized
      ? 0
      : (term.netInstallmentPaid !== undefined && term.netInstallmentPaid !== null
        ? term.netInstallmentPaid
        : Math.max(0, chit.installmentAmount - dividendPerMember));
    const payoutReceived = term.isSelfPrized ? (chit.chitValue - term.winningBidAmount - agentCommission) : 0;

    let savedTerm: ChitTerm;

    if (term.id) {
      const index = current.termTransactions.findIndex(t => t.id === term.id);
      if (index >= 0) {
        savedTerm = {
          ...current.termTransactions[index],
          ...term,
          agentCommission,
          totalDividend,
          dividendPerMember,
          netInstallmentPaid,
          payoutReceived,
          updatedAt: now
        };
        current.termTransactions[index] = savedTerm;
      } else {
        savedTerm = {
          ...term,
          id: term.id,
          agentCommission,
          totalDividend,
          dividendPerMember,
          netInstallmentPaid,
          payoutReceived,
          createdAt: now,
          updatedAt: now
        };
        current.termTransactions.push(savedTerm);
      }
    } else {
      const id = 'term-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      savedTerm = {
        ...term,
        id,
        agentCommission,
        totalDividend,
        dividendPerMember,
        netInstallmentPaid,
        payoutReceived,
        createdAt: now,
        updatedAt: now
      };
      current.termTransactions.push(savedTerm);
    }

    this.syncChitStatus(term.chitId, current);
    this.persist(current);
    return savedTerm;
  }

  deleteTermTransaction(termId: string): boolean {
    const current = { ...this.dataSubject.value };
    const term = current.termTransactions.find(t => t.id === termId);
    current.termTransactions = current.termTransactions.filter(t => t.id !== termId);
    if (term) {
      this.syncChitStatus(term.chitId, current);
    }
    this.persist(current);
    return true;
  }

  // --- Aggregate Stats Helper ---

  getChitSummary(chitId: string) {
    const chit = this.getChitById(chitId);
    if (!chit) return null;

    const terms = this.getTermsByChitId(chitId);
    const termsCompleted = terms.length;
    const totalInvested = terms.reduce((sum, t) => sum + t.netInstallmentPaid, 0);
    const totalDividendEarned = terms.reduce((sum, t) => sum + t.dividendPerMember, 0);
    const selfPrizedTerm = terms.find(t => t.isSelfPrized);
    const payoutReceived = selfPrizedTerm ? selfPrizedTerm.payoutReceived : 0;
    const isSelfPrized = !!selfPrizedTerm;

    // Find the lowest available term number between 1 and chit.totalMembers
    const existingTermNumbers = new Set(terms.map(t => t.termNumber));
    let nextTermNumber = 1;
    while (nextTermNumber <= chit.totalMembers && existingTermNumbers.has(nextTermNumber)) {
      nextTermNumber++;
    }
    const finalNextTermNumber = Math.min(nextTermNumber, chit.totalMembers);

    return {
      chit,
      terms,
      termsCompleted,
      totalInvested,
      totalDividendEarned,
      isSelfPrized,
      selfPrizedTermNumber: selfPrizedTerm?.termNumber,
      payoutReceived,
      nextTermNumber: finalNextTermNumber,
      isFullyCompleted: termsCompleted >= chit.totalMembers
    };
  }

  // --- Export & Import JSON Data ---

  exportDataToJson(): string {
    const data = { ...this.dataSubject.value, exportedAt: new Date().toISOString() };
    return JSON.stringify(data, null, 2);
  }

  importDataFromJson(jsonContent: string): boolean {
    try {
      const parsed = JSON.parse(jsonContent) as AppDataSchema;
      if (parsed && Array.isArray(parsed.chits) && Array.isArray(parsed.termTransactions)) {
        this.persist(parsed);
        return true;
      }
      throw new Error('Invalid JSON format: missing chits or termTransactions arrays.');
    } catch (e) {
      console.error('Import failed:', e);
      throw e;
    }
  }
}
