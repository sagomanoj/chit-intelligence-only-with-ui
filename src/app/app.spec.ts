import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ChitService } from './services/chit.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows a readable backup error as soon as the file has been read', async () => {
    const fixture = TestBed.createComponent(App);
    vi.spyOn(TestBed.inject(ChitService), 'importData').mockImplementationOnce(() => {
      throw new SyntaxError('Unexpected token');
    });
    fixture.componentInstance.openSettings();
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new File(['{'], 'backup.json')] });

    input.dispatchEvent(new Event('change'));

    await expect.poll(() => fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Choose a backup saved from Chit Intelligence');
  });
});

