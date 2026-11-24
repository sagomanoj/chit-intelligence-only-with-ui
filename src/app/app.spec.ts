import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Location } from '@angular/common';
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

  it('dismisses a sheet, then settings, before going back through screen history', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => {});
    app.openSettings();
    const sheet = document.createElement('dialog');
    sheet.setAttribute('appSheet', '');
    sheet.open = true;
    sheet.addEventListener('cancel', () => sheet.remove(), { once: true });
    fixture.nativeElement.appendChild(sheet);

    app.androidBack(true);
    expect(sheet.isConnected).toBe(false);
    expect(app.showSettingsModal).toBe(true);
    app.androidBack(true);
    expect(app.showSettingsModal).toBe(false);
    expect(back).not.toHaveBeenCalled();
    app.androidBack(true);
    expect(back).toHaveBeenCalledOnce();
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

