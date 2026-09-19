import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChitService, Chit, ChitTerm } from '../services/chit.service';

export interface MonthScheduleChitItem {
  chitId: string;
  chitName: string;
  termNumber: number;
  totalMembers: number;
  scheduledDate: string; // YYYY-MM-DD
  isRecorded: boolean;
  isSelfPrizedInThisTerm: boolean;
  isSelfPrizedInPriorTerm: boolean;
  installmentAmount: number;
  actualNetPaid?: number;
  minExpectedPayment: number;
  maxExpectedPayment: number;
}

export interface MonthScheduleGroup {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. Sep 2026
  year: number;
  month: number;
  items: MonthScheduleChitItem[];
  minTotalPayment: number;
  maxTotalPayment: number;
  avgTotalPayment: number;
  recordedCount: number;
  upcomingCount: number;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  chits: Chit[] = [];

  // Buffer range percentage controls
  minBufferPercent: number = 20;
  maxBufferPercent: number = 30;
  maxMonthOutflowValue: number = 1;

  // Live buffer sample calculation helper
  sampleInstallment: number = 10000;

  get sampleMinDiscount(): number {
    return Math.round(this.sampleInstallment * (this.minBufferPercent / 100));
  }

  get sampleMaxDiscount(): number {
    return Math.round(this.sampleInstallment * (this.maxBufferPercent / 100));
  }

  get sampleMinOutflow(): number {
    return this.sampleInstallment - this.sampleMaxDiscount;
  }

  get sampleMaxOutflow(): number {
    return this.sampleInstallment - this.sampleMinDiscount;
  }

  // Month groups schedule & carousel state
  monthGroups: MonthScheduleGroup[] = [];
  selectedMonthIndex: number = 0;
  selectedMonthGroup: MonthScheduleGroup | null = null;
  showMonthModal: boolean = false;

  // KPI Overview
  totalPortfolioValue: number = 0;
  totalDividendsRealized: number = 0;
  totalPrizeMoneyWon: number = 0;
  currentMonthMinOutflow: number = 0;
  currentMonthMaxOutflow: number = 0;

  constructor(
    private chitService: ChitService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  setBufferPreset(min: number, max: number): void {
    this.minBufferPercent = min;
    this.maxBufferPercent = max;
    this.onBufferRangeChange();
  }

  getOutflowPercent(group: MonthScheduleGroup | null): number {
    if (!group || !this.maxMonthOutflowValue || this.maxMonthOutflowValue === 0) return 0;
    return Math.min(100, Math.round((group.maxTotalPayment / this.maxMonthOutflowValue) * 100));
  }

  loadDashboardData(): void {
    this.chitService.getChits().subscribe(chits => {
      this.chits = chits;
      this.calculateKpisAndProjections();
    });
  }

  onBufferRangeChange(): void {
    if (this.minBufferPercent > this.maxBufferPercent) {
      this.minBufferPercent = this.maxBufferPercent;
    }
    this.calculateKpisAndProjections();
  }

  private addMonthsToDate(dateStr: string, months: number): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    d.setMonth(d.getMonth() + months);

    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d.toISOString().split('T')[0];
  }

  calculateKpisAndProjections(): void {
    if (!this.chits || this.chits.length === 0) {
      this.monthGroups = [];
      this.selectedMonthIndex = 0;
      this.totalPortfolioValue = 0;
      this.totalDividendsRealized = 0;
      this.totalPrizeMoneyWon = 0;
      this.currentMonthMinOutflow = 0;
      this.currentMonthMaxOutflow = 0;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthKey = todayStr.substring(0, 7);

    let portfolioVal = 0;
    let totalDiv = 0;
    let totalWon = 0;

    const groupsMap = new Map<string, MonthScheduleChitItem[]>();

    this.chits.forEach(chit => {
      portfolioVal += chit.chitValue;
      const terms = this.chitService.getTermsSync(chit.id);

      terms.forEach(t => {
        totalDiv += t.dividendPerMember || 0;
        if (t.isSelfPrized) {
          totalWon += t.payoutReceived || 0;
        }
      });

      // Skip generating future payment schedule if chit is already completed
      const isCompleted = chit.status === 'COMPLETED' || terms.length >= chit.totalMembers;
      if (isCompleted) return;

      const frequency = Math.max(1, chit.frequencyInMonths || 1);

      // Check if self-prized in any past recorded term
      const prizedTerm = terms.find(t => t.isSelfPrized);
      const isAlreadyTaken = !!prizedTerm;

      // Find lowest missing / next upcoming term number
      const existingTermNumbers = new Set(terms.map(t => t.termNumber));
      let nextTermNumber = 1;
      while (nextTermNumber <= chit.totalMembers && existingTermNumbers.has(nextTermNumber)) {
        nextTermNumber++;
      }

      if (nextTermNumber > chit.totalMembers) return;

      // Calculate initial base date for next upcoming term
      const recordedTermsList = terms.filter(t => t.auctionDate);
      let baseDate = chit.startDate ? chit.startDate : todayStr;
      let nextTermDate = todayStr;

      if (recordedTermsList.length > 0) {
        const sorted = [...recordedTermsList].sort((a, b) => b.termNumber - a.termNumber);
        const lastRecorded = sorted[0];
        const diff = Math.max(1, nextTermNumber - lastRecorded.termNumber);
        nextTermDate = this.addMonthsToDate(lastRecorded.auctionDate, diff * frequency);
      } else {
        nextTermDate = this.addMonthsToDate(baseDate, (nextTermNumber - 1) * frequency);
      }

      // Project remaining upcoming terms for this active chit
      for (let tNum = nextTermNumber; tNum <= chit.totalMembers; tNum++) {
        const offset = tNum - nextTermNumber;
        const scheduledDate = this.addMonthsToDate(nextTermDate, offset * frequency);
        let monthKey = scheduledDate.substring(0, 7);
        if (monthKey < currentMonthKey) {
          monthKey = currentMonthKey;
        }

        let minPayment = 0;
        let maxPayment = 0;

        if (isAlreadyTaken) {
          // Chit already won in prior term — must pay full installment amount
          minPayment = chit.installmentAmount;
          maxPayment = chit.installmentAmount;
        } else {
          // Non-prized chit — apply estimated dividend discount buffer
          minPayment = Math.round(chit.installmentAmount * (1 - (this.maxBufferPercent / 100)));
          maxPayment = Math.round(chit.installmentAmount * (1 - (this.minBufferPercent / 100)));
        }

        const item: MonthScheduleChitItem = {
          chitId: chit.id,
          chitName: chit.name,
          termNumber: tNum,
          totalMembers: chit.totalMembers,
          scheduledDate,
          isRecorded: false,
          isSelfPrizedInThisTerm: false,
          isSelfPrizedInPriorTerm: isAlreadyTaken,
          installmentAmount: chit.installmentAmount,
          minExpectedPayment: minPayment,
          maxExpectedPayment: maxPayment
        };

        if (!groupsMap.has(monthKey)) {
          groupsMap.set(monthKey, []);
        }
        groupsMap.get(monthKey)!.push(item);
      }
    });

    this.totalPortfolioValue = portfolioVal;
    this.totalDividendsRealized = Math.round(totalDiv);
    this.totalPrizeMoneyWon = Math.round(totalWon);

    // Build sorted MonthScheduleGroup array (Current and Future months only)
    const sortedMonthKeys = Array.from(groupsMap.keys())
      .filter(key => key >= currentMonthKey)
      .sort();
    const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

    this.monthGroups = sortedMonthKeys.map(key => {
      const items = groupsMap.get(key)!;
      const [yStr, mStr] = key.split('-');
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);

      const d = new Date(year, month - 1, 1);
      const monthLabel = monthFormatter.format(d);

      let minTotal = 0;
      let maxTotal = 0;
      let recCount = 0;
      let upCount = 0;

      items.forEach(it => {
        minTotal += it.minExpectedPayment;
        maxTotal += it.maxExpectedPayment;
        if (it.isRecorded) recCount++; else upCount++;
      });

      return {
        monthKey: key,
        monthLabel,
        year,
        month,
        items,
        minTotalPayment: minTotal,
        maxTotalPayment: maxTotal,
        avgTotalPayment: Math.round((minTotal + maxTotal) / 2),
        recordedCount: recCount,
        upcomingCount: upCount,
        isCurrentMonth: key === currentMonthKey
      };
    });

    this.maxMonthOutflowValue = Math.max(...this.monthGroups.map(g => g.maxTotalPayment), 1);

    // Current Month Outflow KPI & Default Carousel Selection
    const currentGroupIndex = this.monthGroups.findIndex(g => g.isCurrentMonth);
    if (currentGroupIndex !== -1) {
      const currentGroup = this.monthGroups[currentGroupIndex];
      this.currentMonthMinOutflow = currentGroup.minTotalPayment;
      this.currentMonthMaxOutflow = currentGroup.maxTotalPayment;
      this.selectedMonthIndex = currentGroupIndex;
    } else {
      this.currentMonthMinOutflow = 0;
      this.currentMonthMaxOutflow = 0;
      this.selectedMonthIndex = 0;
    }
  }

  // Carousel navigation controls
  get activeMonthGroup(): MonthScheduleGroup | null {
    if (!this.monthGroups || this.monthGroups.length === 0) return null;
    if (this.selectedMonthIndex < 0) this.selectedMonthIndex = 0;
    if (this.selectedMonthIndex >= this.monthGroups.length) this.selectedMonthIndex = this.monthGroups.length - 1;
    return this.monthGroups[this.selectedMonthIndex];
  }

  nextMonth(): void {
    if (this.selectedMonthIndex < this.monthGroups.length - 1) {
      this.selectedMonthIndex++;
    }
  }

  prevMonth(): void {
    if (this.selectedMonthIndex > 0) {
      this.selectedMonthIndex--;
    }
  }

  goToMonth(index: number): void {
    if (index >= 0 && index < this.monthGroups.length) {
      this.selectedMonthIndex = index;
    }
  }

  goToCurrentMonth(): void {
    const currentIdx = this.monthGroups.findIndex(g => g.isCurrentMonth);
    if (currentIdx !== -1) {
      this.selectedMonthIndex = currentIdx;
    }
  }

  openMonthModal(group: MonthScheduleGroup): void {
    this.selectedMonthGroup = group;
    this.showMonthModal = true;
  }

  closeMonthModal(): void {
    this.showMonthModal = false;
    this.selectedMonthGroup = null;
  }

  viewChit(id: string): void {
    this.router.navigate(['/chits', id]);
  }
}
